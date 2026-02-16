// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use base64::Engine;
use serde::Serialize;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(Serialize)]
struct RenderResult {
    ok: bool,
    stdout: String,
    stderr: String,
    output_path: Option<String>,
    work_dir: String,
    script_path: String,
}

#[derive(Serialize)]
struct InstallResult {
    ok: bool,
    stdout: String,
    stderr: String,
    work_dir: String,
}

fn app_work_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir error: {e}"))?;
    Ok(base_dir.join("projects").join("default"))
}

fn run_capture(cmd: &mut std::process::Command) -> Result<(bool, String, String), String> {
    let out = cmd
        .output()
        .map_err(|e| format!("failed to execute: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    Ok((out.status.success(), stdout, stderr))
}

/// Ensure Manim is installed in an isolated uv environment stored inside the app-data project directory.
///
/// This keeps things separate per-OS and avoids relying on system python.
#[tauri::command]
fn install_manim(app: tauri::AppHandle) -> Result<InstallResult, String> {
    use std::fs;
    use std::process::Command;

    let work_dir = app_work_dir(&app)?;
    fs::create_dir_all(&work_dir).map_err(|e| format!("create_dir_all error: {e}"))?;

    // Create an isolated venv in the project directory (idempotent).
    // We keep it inside work_dir so it is per-OS via app_data_dir.
    let venv_dir = work_dir.join(".venv");
    if !venv_dir.exists() {
        let (ok, out, err) = {
            let mut cmd = Command::new("uv");
            cmd.current_dir(&work_dir)
                .arg("venv")
                .arg(venv_dir.as_os_str());
            run_capture(&mut cmd)?
        };
        if !ok {
            return Ok(InstallResult {
                ok,
                stdout: out,
                stderr: err,
                work_dir: work_dir.to_string_lossy().to_string(),
            });
        }
    }

    // Install manim into a uv-managed environment in this work_dir.
    // `uv add` is for pyproject-based workflows; simplest universal approach is `uv pip install`.
    // We also pin nothing yet; that can come later (lockfile).
    // Note: venv python location differs on Windows.
    let venv_python = if cfg!(windows) {
        venv_dir.join("Scripts").join("python.exe")
    } else {
        venv_dir.join("bin").join("python")
    };

    let mut cmd = Command::new("uv");
    cmd.current_dir(&work_dir)
        .arg("pip")
        .arg("install")
        .arg("--python")
        .arg(venv_python)
        .arg("manim");

    let (ok, stdout, stderr) = run_capture(&mut cmd)?;

    Ok(InstallResult {
        ok,
        stdout,
        stderr,
        work_dir: work_dir.to_string_lossy().to_string(),
    })
}

/// Render Manim by writing the passed code into a project-local app data directory,
/// then (optionally) invoking `manim`.
///
/// For now, this is a safe stub that does not execute arbitrary commands unless `manim`
/// is available on PATH; it returns captured logs and (when available) an output path.
#[tauri::command]
fn render_manim(app: tauri::AppHandle, code: String) -> Result<RenderResult, String> {
    use std::fs;
    use std::process::Command;

    let work_dir = app_work_dir(&app)?;

    fs::create_dir_all(&work_dir).map_err(|e| format!("create_dir_all error: {e}"))?;

    let script_path = work_dir.join("scene.py");
    fs::write(&script_path, code).map_err(|e| format!("write scene.py error: {e}"))?;

    // Try to invoke manim if present; otherwise return a helpful message.
    let stdout: String;
    let stderr: String;
    let mut output_path: Option<String> = None;

    // Common invocation choices:
    // 1) `manim -ql scene.py Test` (when manim is on PATH)
    // 2) `python3 -m manim -ql scene.py Test` (when manim is installed in python but no shim exists)
    // NOTE: We intentionally keep this minimal and deterministic.
    let scene_file = script_path
        .file_name()
        .ok_or_else(|| "invalid script filename".to_string())?;

    let venv_dir = work_dir.join(".venv");
    let venv_python = if cfg!(windows) {
        venv_dir.join("Scripts").join("python.exe")
    } else {
        venv_dir.join("bin").join("python")
    };

    let try_uv = || {
        Command::new("uv")
            .current_dir(&work_dir)
            .arg("run")
            .arg("manim")
            .arg("-ql")
            .arg(scene_file)
            .arg("Test")
            .output()
    };

    let try_venv_python_module = || {
        if !venv_python.exists() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "uv venv not found; run install first",
            ));
        }
        Command::new(&venv_python)
            .current_dir(&work_dir)
            .arg("-m")
            .arg("manim")
            .arg("-ql")
            .arg(scene_file)
            .arg("Test")
            .output()
    };

    let try_manim = || {
        Command::new("manim")
            .current_dir(&work_dir)
            .arg("-ql")
            .arg(scene_file)
            .arg("Test")
            .output()
    };

    let try_python_module = |python: &str| {
        Command::new(python)
            .current_dir(&work_dir)
            .arg("-m")
            .arg("manim")
            .arg("-ql")
            .arg(scene_file)
            .arg("Test")
            .output()
    };

    let result = match try_uv() {
        Ok(out) => Ok(out),
        Err(_) => match try_venv_python_module() {
            Ok(out) => Ok(out),
            Err(_) => match try_manim() {
                Ok(out) => Ok(out),
                Err(_) => {
                    // fallback to python module execution
                    try_python_module("python3").or_else(|_| try_python_module("python"))
                }
            },
        },
    };

    match result {
        Ok(out) => {
            stdout = String::from_utf8_lossy(&out.stdout).to_string();
            stderr = String::from_utf8_lossy(&out.stderr).to_string();
            // Best-effort guess; real wiring will parse output or search media dir.
            let candidate = work_dir
                .join("media")
                .join("videos")
                .join("scene")
                .join("480p15")
                .join("Test.mp4");
            if candidate.exists() {
                output_path = Some(candidate.to_string_lossy().to_string());
            }
            Ok(RenderResult {
                ok: out.status.success(),
                stdout,
                stderr,
                output_path,
                work_dir: work_dir.to_string_lossy().to_string(),
                script_path: script_path.to_string_lossy().to_string(),
            })
        }
        Err(e) => {
            // Neither `manim` nor `python -m manim` worked.
            Ok(RenderResult {
                ok: false,
                stdout: String::new(),
                stderr: format!(
                    "Failed to execute Manim. Tried `manim`, then `python3 -m manim`, then `python -m manim`. Last error: {e}.\n\nIf you installed Manim in a virtualenv/conda env, make sure Tauri launches with that env on PATH, or configure this app to use an explicit python path."
                ),
                output_path,
                work_dir: work_dir.to_string_lossy().to_string(),
                script_path: script_path.to_string_lossy().to_string(),
            })
        }
    }
}

#[derive(Serialize)]
struct ReadFileBase64Result {
    ok: bool,
    mime: String,
    base64: String,
    bytes: usize,
}

#[tauri::command]
fn read_file_base64(app: tauri::AppHandle, path: String) -> Result<ReadFileBase64Result, String> {
    use std::fs;
    use std::path::PathBuf;

    // Only allow reading inside the app's work dir (app data), to avoid arbitrary file reads.
    let work_dir = app_work_dir(&app)?;
    let req_path = PathBuf::from(path);

    let canon_work = work_dir
        .canonicalize()
        .map_err(|e| format!("canonicalize work_dir error: {e}"))?;
    let canon_req = req_path
        .canonicalize()
        .map_err(|e| format!("canonicalize path error: {e}"))?;

    if !canon_req.starts_with(&canon_work) {
        return Err("path is outside app work dir".to_string());
    }

    let bytes = fs::read(&canon_req).map_err(|e| format!("read file error: {e}"))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(ReadFileBase64Result {
        ok: true,
        mime: "video/mp4".to_string(),
        base64: b64,
        bytes: bytes.len(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            install_manim,
            render_manim,
            read_file_base64
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
