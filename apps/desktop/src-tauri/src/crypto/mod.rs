use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};

const KEY_SIZE: usize = 32; // 256 bits
const NONCE_SIZE: usize = 12; // 96 bits

/// Encryption result containing the encrypted data and nonce
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    pub ciphertext: String,
    pub nonce: String,
}

/// Encryption error
#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("Encryption failed: {0}")]
    EncryptionError(String),

    #[error("Decryption failed: {0}")]
    DecryptionError(String),

    #[error("Invalid key length")]
    InvalidKeyLength,

    #[error("Base64 error: {0}")]
    Base64Error(#[from] base64::DecodeError),
}

/// Encrypt data using AES-256-GCM
pub fn encrypt(data: &str, key: &[u8; KEY_SIZE]) -> Result<EncryptedData, CryptoError> {
    let cipher = Aes256Gcm::new(key.into());
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data.as_bytes())
        .map_err(|e| CryptoError::EncryptionError(e.to_string()))?;

    Ok(EncryptedData {
        ciphertext: STANDARD.encode(ciphertext),
        nonce: STANDARD.encode(nonce_bytes),
    })
}

/// Decrypt data using AES-256-GCM
pub fn decrypt(encrypted: &EncryptedData, key: &[u8; KEY_SIZE]) -> Result<String, CryptoError> {
    let cipher = Aes256Gcm::new(key.into());
    let nonce_bytes = STANDARD.decode(&encrypted.nonce)?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = STANDARD.decode(&encrypted.ciphertext)?;

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| CryptoError::DecryptionError(e.to_string()))?;

    String::from_utf8(plaintext)
        .map_err(|e| CryptoError::DecryptionError(e.to_string()))
}

/// Generate a random encryption key
pub fn generate_key() -> [u8; KEY_SIZE] {
    let mut key = [0u8; KEY_SIZE];
    OsRng.fill_bytes(&mut key);
    key
}

/// Derive a key from a password using PBKDF2
pub fn derive_key(password: &str, salt: &[u8; 32]) -> [u8; KEY_SIZE] {
    use pbkdf2::pbkdf2_hmac;
    use sha2::Sha256;

    let mut key = [0u8; KEY_SIZE];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 100_000, &mut key);
    key
}

/// Hash a value using SHA-256
pub fn hash(value: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let key = generate_key();
        let plaintext = "Hello, Pantheon Forge!";
        let encrypted = encrypt(plaintext, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_hash() {
        let hash1 = hash("test");
        let hash2 = hash("test");
        let hash3 = hash("different");
        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
    }
}
