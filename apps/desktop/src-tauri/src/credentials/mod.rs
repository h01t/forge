use crate::llm::types::ProviderId;
use keyring::Entry;
use serde::{Deserialize, Serialize};

const SERVICE_NAME: &str = "PantheonForge";

/// Credential storage error
#[derive(Debug, thiserror::Error)]
pub enum CredentialError {
    #[error("Keyring error: {0}")]
    KeyringError(#[from] keyring::Error),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("Credential not found: {0}")]
    NotFound(String),
}

/// Stored provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCredential {
    pub provider_id: ProviderId,
    pub api_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub created_at: i64,
}

/// All stored credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredCredentials {
    pub providers: Vec<ProviderCredential>,
}

impl Default for StoredCredentials {
    fn default() -> Self {
        Self {
            providers: Vec::new(),
        }
    }
}

/// Credential manager using system keyring
pub struct CredentialManager {
    service_name: String,
}

impl CredentialManager {
    pub fn new() -> Self {
        Self {
            service_name: SERVICE_NAME.to_string(),
        }
    }

    /// Get the keyring entry for credentials
    fn get_entry(&self) -> Result<Entry, CredentialError> {
        Entry::new(&self.service_name, "credentials").map_err(Into::into)
    }

    /// Load all stored credentials
    pub fn load_credentials(&self) -> Result<StoredCredentials, CredentialError> {
        let entry = self.get_entry()?;
        let password = entry.get_password().unwrap_or_else(|_| String::from("{}"));

        if password.is_empty() {
            return Ok(StoredCredentials::default());
        }

        let creds: StoredCredentials = serde_json::from_str(&password)?;
        Ok(creds)
    }

    /// Save all credentials
    pub fn save_credentials(&self, credentials: &StoredCredentials) -> Result<(), CredentialError> {
        let entry = self.get_entry()?;
        let json = serde_json::to_string(credentials)?;
        entry.set_password(&json)?;
        Ok(())
    }

    /// Store or update a provider credential
    pub fn store_provider(&self, credential: ProviderCredential) -> Result<(), CredentialError> {
        let mut creds = self.load_credentials().unwrap_or_default();

        // Remove existing credential for this provider
        creds
            .providers
            .retain(|c| c.provider_id != credential.provider_id);

        // Add new credential
        creds.providers.push(credential);

        self.save_credentials(&creds)
    }

    /// Get a credential for a provider
    pub fn get_provider(
        &self,
        provider_id: ProviderId,
    ) -> Result<ProviderCredential, CredentialError> {
        let creds = self.load_credentials()?;

        creds
            .providers
            .into_iter()
            .find(|c| c.provider_id == provider_id)
            .ok_or_else(|| CredentialError::NotFound(provider_id.as_str().to_string()))
    }

    /// Remove a provider credential
    pub fn remove_provider(&self, provider_id: ProviderId) -> Result<(), CredentialError> {
        let mut creds = self.load_credentials().unwrap_or_default();

        // Check if provider exists
        let exists = creds.providers.iter().any(|c| c.provider_id == provider_id);
        if !exists {
            return Err(CredentialError::NotFound(provider_id.as_str().to_string()));
        }

        creds.providers.retain(|c| c.provider_id != provider_id);
        self.save_credentials(&creds)
    }

    /// Check if a provider has credentials
    pub fn has_provider(&self, provider_id: ProviderId) -> bool {
        self.load_credentials()
            .map(|creds| creds.providers.iter().any(|c| c.provider_id == provider_id))
            .unwrap_or(false)
    }

    /// List all providers with stored credentials
    pub fn list_providers(&self) -> Result<Vec<ProviderId>, CredentialError> {
        let creds = self.load_credentials()?;
        Ok(creds.providers.into_iter().map(|c| c.provider_id).collect())
    }

    /// Clear all credentials
    pub fn clear_all(&self) -> Result<(), CredentialError> {
        let entry = self.get_entry()?;
        entry.delete_credential().ok();
        Ok(())
    }
}

impl Default for CredentialManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Global credential manager instance
static CREDENTIAL_MANAGER: std::sync::OnceLock<CredentialManager> = std::sync::OnceLock::new();

pub fn get_credential_manager() -> &'static CredentialManager {
    CREDENTIAL_MANAGER.get_or_init(CredentialManager::new)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_store_and_retrieve() {
        let manager = CredentialManager::new();

        let credential = ProviderCredential {
            provider_id: ProviderId::Anthropic,
            api_key: "test-api-key-123".to_string(),
            base_url: None,
            model: Some("claude-3-5-sonnet".to_string()),
            created_at: chrono::Utc::now().timestamp(),
        };

        if let Err(error) = manager.store_provider(credential) {
            match error {
                CredentialError::KeyringError(keyring::Error::PlatformFailure(_)) => return,
                other => panic!("unexpected credential error: {other:?}"),
            }
        }

        let retrieved = manager.get_provider(ProviderId::Anthropic).unwrap();
        assert_eq!(retrieved.api_key, "test-api-key-123");
        assert_eq!(retrieved.model, Some("claude-3-5-sonnet".to_string()));

        manager.remove_provider(ProviderId::Anthropic).ok();
    }
}
