//! Upscaleer desktop shell: image inference stays in the local WebView2 WebGPU/WASM.
//! Only the native Save As dialog and writing user-approved result bytes use Rust.
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{ipc::{InvokeBody, Request}, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct PendingSave(Mutex<Option<PathBuf>>);

/// Opens the native Windows Save As dialog. The chosen path is never supplied
/// by arbitrary JavaScript: only a user-approved dialog path may be written.
#[tauri::command]
fn prepare_save(app: tauri::AppHandle, file_name: String, state: State<'_, PendingSave>) -> Result<bool, String> {
    let safe_name = Path::new(&file_name)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("upscaleer.png");
    let selection = app.dialog().file()
        .set_title("Save upscaled image")
        .set_file_name(safe_name)
        .blocking_save_file();
    let mut pending = state.0.lock().map_err(|_| "Save state unavailable".to_string())?;
    *pending = match selection {
        Some(selected) => Some(selected.into_path().map_err(|err| err.to_string())?),
        None => None,
    };
    Ok(pending.is_some())
}

/// Raw binary IPC avoids Base64 expansion/large JSON arrays. The pending path
/// is consumed after one write and cannot be reused without another Save dialog.
#[tauri::command]
fn write_image(request: Request<'_>, state: State<'_, PendingSave>) -> Result<(), String> {
    let path = state.0.lock()
        .map_err(|_| "Save state unavailable".to_string())?
        .take()
        .ok_or_else(|| "No Save As destination was selected".to_string())?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected raw binary image data".to_string());
    };
    if bytes.is_empty() {
        return Err("Image is empty".to_string());
    }
    std::fs::write(path, bytes).map_err(|err| format!("Could not save image: {err}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PendingSave::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![prepare_save, write_image])
        .run(tauri::generate_context!())
        .expect("Upscaleer could not launch");
}
