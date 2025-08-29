// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    leenim_lib::run()
}

#[tauri::command]
async fn run_manim(code: String) -> Result<String, String> {
    // TODO: Save `code` to a temp file, run manim via std::process::Command
    // Return path to rendered video or error message
    Ok("rendered.mp4".into())
}
