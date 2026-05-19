import type { CreateCredentialRequest } from '@simple-agent-manager/shared';
import { PROVIDER_HELP, PROVIDER_LABELS } from '@simple-agent-manager/shared';
import { Alert, Input } from '@simple-agent-manager/ui';
import { useRef, useState } from 'react';

import { createCredential, validateCredential } from '../../lib/api';
import { CompleteState, OptionCard, StepActions } from './StepShared';

type CloudProvider = 'hetzner' | 'scaleway';

interface ProviderOption {
  id: CloudProvider;
  name: string;
  description: string;
  helpUrl: string;
  helpText: string;
}

const PROVIDERS: ProviderOption[] = (['hetzner', 'scaleway'] as const).map((id) => ({
  id,
  name: PROVIDER_LABELS[id] ?? id,
  description: PROVIDER_HELP[id]?.description ?? '',
  helpUrl: PROVIDER_HELP[id]?.helpUrl ?? '',
  helpText: PROVIDER_HELP[id]?.helpText ?? '',
}));

interface StepCloudProviderProps {
  onComplete: () => void;
  onSkip: () => void;
  isComplete: boolean;
}

function getValidateButtonLabel(validating: boolean, isValidated: boolean): string {
  if (validating) return 'Testing...';
  if (isValidated) return 'Tested';
  return 'Test connection';
}

function hasRequiredProviderFields(
  provider: CloudProvider | null,
  token: string,
  scalewayProjectId: string
): boolean {
  if (provider === 'hetzner') return !!token.trim();
  if (provider === 'scaleway') return !!token.trim() && !!scalewayProjectId.trim();
  return false;
}

export function StepCloudProvider({ onComplete, onSkip, isComplete }: StepCloudProviderProps) {
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);
  const [token, setToken] = useState('');
  const [scalewayProjectId, setScalewayProjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validatedKey, setValidatedKey] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestCredentialKey = useRef<string | null>(null);

  if (isComplete) {
    return (
      <CompleteState
        title="Cloud provider connected"
        description="You can manage your credentials in Settings."
        onContinue={onComplete}
      />
    );
  }

  const getCredentialRequest = (): CreateCredentialRequest | null => {
    if (!selectedProvider || !token.trim()) return null;
    if (selectedProvider === 'hetzner') return { provider: 'hetzner', token: token.trim() };
    if (!scalewayProjectId.trim()) return null;
    return { provider: 'scaleway', secretKey: token.trim(), projectId: scalewayProjectId.trim() };
  };

  const credentialKey = JSON.stringify(getCredentialRequest());
  latestCredentialKey.current = credentialKey;
  const isValidated = validatedKey === credentialKey;

  const handleValidate = async () => {
    const data = getCredentialRequest();
    if (!data) {
      setError(
        selectedProvider === 'scaleway'
          ? 'Scaleway Project ID is required'
          : 'Select a provider and enter a token'
      );
      return;
    }
    setValidating(true);
    setValidationMessage(null);
    setError(null);
    const requestKey = credentialKey;
    try {
      const result = await validateCredential(data);
      if (latestCredentialKey.current !== requestKey) return;
      setValidatedKey(requestKey);
      setValidationMessage(result.message);
    } catch (err) {
      if (latestCredentialKey.current !== requestKey) return;
      setValidatedKey(null);
      setError(err instanceof Error ? err.message : 'Credential validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    const data = getCredentialRequest();
    if (!data) return;
    if (!isValidated) {
      await handleValidate();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createCredential(data);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  const selectedDef = selectedProvider ? PROVIDERS.find((p) => p.id === selectedProvider) : null;
  const isValid = hasRequiredProviderFields(selectedProvider, token, scalewayProjectId);

  return (
    <div>
      <h3 className="sam-type-section-heading text-fg-primary m-0 mb-1">Connect your cloud</h3>
      <p className="sam-type-body text-fg-muted m-0 mb-4">
        SAM provisions VMs on <strong>your</strong> cloud account. You keep full control and pay
        your provider directly.
      </p>

      {error && (
        <div className="mb-3">
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {/* Provider selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {PROVIDERS.map((provider) => (
          <OptionCard
            key={provider.id}
            name={provider.name}
            description={provider.description}
            isSelected={selectedProvider === provider.id}
            onSelect={() => {
              setSelectedProvider(provider.id);
              setError(null);
              setValidatedKey(null);
              setValidationMessage(null);
            }}
          />
        ))}
      </div>

      {/* Token input */}
      {selectedDef && (
        <div className="mb-4">
          <label
            htmlFor="cloud-provider-token"
            className="block text-sm font-medium text-fg-primary mb-1"
          >
            {selectedDef.name} API Token
          </label>
          <Input
            id="cloud-provider-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setValidatedKey(null);
              setValidationMessage(null);
            }}
            placeholder={`Paste your ${selectedDef.name} API token`}
          />

          {selectedProvider === 'scaleway' && (
            <div className="mt-2">
              <label
                htmlFor="scaleway-project-id"
                className="block text-sm font-medium text-fg-primary mb-1"
              >
                Scaleway Project ID
              </label>
              <Input
                id="scaleway-project-id"
                type="text"
                value={scalewayProjectId}
                onChange={(e) => {
                  setScalewayProjectId(e.target.value);
                  setValidatedKey(null);
                  setValidationMessage(null);
                }}
                placeholder="Your Scaleway project ID"
              />
            </div>
          )}

          <a
            href={selectedDef.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline mt-1 inline-block"
          >
            {selectedDef.helpText}
          </a>
        </div>
      )}

      {validationMessage && (
        <div className="mb-3">
          <Alert variant="success">{validationMessage}</Alert>
        </div>
      )}

      <StepActions
        onSkip={onSkip}
        onValidate={handleValidate}
        onSave={handleSave}
        testDisabled={!isValid || validating || saving}
        connectDisabled={!isValid || saving || validating || !isValidated}
        testLabel={getValidateButtonLabel(validating, isValidated)}
        saveLabel={saving ? 'Saving...' : 'Connect'}
      />
    </div>
  );
}
