//! Integration test for `BulletinSource::Http` against a hand-rolled mock HTTP
//! server (no extra deps). Proves the gateway wire contract — PUT /bulletin then
//! GET /bulletin — round-trips a Bulletin without a real container.

use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use std::thread;

use bulletin_store::{Bulletin, BulletinSource, Voter};

/// Reads a full HTTP/1.1 request (headers + Content-Length body) from the stream.
/// Returns (method, body_bytes).
fn read_request(stream: &mut std::net::TcpStream) -> (String, Vec<u8>) {
    let mut buf = Vec::new();
    let mut tmp = [0u8; 1024];
    // Read until we have the header terminator.
    let header_end = loop {
        if let Some(pos) = find_subslice(&buf, b"\r\n\r\n") {
            break pos + 4;
        }
        let n = stream.read(&mut tmp).expect("read headers");
        if n == 0 {
            break buf.len();
        }
        buf.extend_from_slice(&tmp[..n]);
    };

    let header_text = String::from_utf8_lossy(&buf[..header_end]).to_string();
    let method = header_text
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_string();
    let content_length = header_text
        .lines()
        .find_map(|l| {
            let l = l.to_ascii_lowercase();
            l.strip_prefix("content-length:")
                .map(|v| v.trim().parse::<usize>().unwrap_or(0))
        })
        .unwrap_or(0);

    let mut body = buf[header_end..].to_vec();
    while body.len() < content_length {
        let n = stream.read(&mut tmp).expect("read body");
        if n == 0 {
            break;
        }
        body.extend_from_slice(&tmp[..n]);
    }
    (method, body)
}

fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

fn respond_json(stream: &mut std::net::TcpStream, body: &[u8]) {
    let header = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(header.as_bytes()).unwrap();
    stream.write_all(body).unwrap();
    stream.flush().unwrap();
}

#[test]
fn http_source_put_then_get_roundtrips() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let store = Arc::new(Mutex::new(Bulletin::empty()));

    let server_store = Arc::clone(&store);
    let handle = thread::spawn(move || {
        // Handle exactly two requests: the PUT then the GET.
        for conn in listener.incoming().take(2) {
            let mut stream = conn.unwrap();
            let (method, body) = read_request(&mut stream);
            match method.as_str() {
                "PUT" => {
                    let b: Bulletin = serde_json::from_slice(&body).unwrap();
                    *server_store.lock().unwrap() = b;
                    respond_json(&mut stream, b"{}");
                }
                "GET" => {
                    let b = server_store.lock().unwrap().clone();
                    let bytes = serde_json::to_vec(&b).unwrap();
                    respond_json(&mut stream, &bytes);
                }
                other => panic!("unexpected method {other}"),
            }
        }
    });

    let src = BulletinSource::Http(format!("http://{addr}"));
    let mut b = Bulletin::empty();
    b.voters.push(Voter {
        id: "v-000001".into(),
        email: "voter1@wmsu.edu.ph".into(),
        name: "Demo Voter".into(),
    });

    src.save(&b).expect("http save");
    let loaded = src.load().expect("http load");
    assert_eq!(loaded, b);

    handle.join().unwrap();
}
