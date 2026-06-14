mod balota;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            balota::load_bulletin,
            balota::create_election,
            balota::register_voter,
            balota::issue_credential,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
