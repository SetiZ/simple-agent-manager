import type { AgentType, SaveAgentCredentialRequest } from '@simple-agent-manager/shared';
import { AGENT_CATALOG } from '@simple-agent-manager/shared';
import { Alert, Input } from '@simple-agent-manager/ui';
import { useRef, useState } from 'react';

import { saveAgentCredential, validateAgentCredential } from '../../lib/api';
import { CompleteState, OptionCard, StepActions } from './StepShared';

interface StepAgentKeyProps {
  onComplete: () => void;
  onSkip: () => void;
  isComplete: boolean;
}

function getValidateButtonLabel(validating: boolean, isValidated: boolean): string {
  if (validating) return 'Testing...';
  if (isValidated) return 'Tested';
  return 'Test key';
}

export function StepAgentKey({ onComplete, onSkip, isComplete }: StepAgentKeyProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentType | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validatedKey, setValidatedKey] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestCredentialKey = useRef<string | null>(null);

  if (isComplete) {
    return (
      <CompleteState
        title="AI agent connected"
        description="You can manage your agent keys in Settings."
        onContinue={onComplete}
      />
    );
  }

  const getCredentialRequest = (): SaveAgentCredentialRequest | null => {
    if (!selectedAgent || !apiKey.trim()) return null;
    return {
      agentType: selectedAgent,
      credentialKind: 'api-key',
      credential: apiKey.trim(),
    };
  };

  const credentialKey = JSON.stringify(getCredentialRequest());
  latestCredentialKey.current = credentialKey;
  const isValidated = validatedKey === credentialKey;

  const handleValidate = async () => {
    const data = getCredentialRequest();
    if (!data) {
      setError('Select an agent and enter an API key');
      return;
    }
    setValidating(true);
    setValidationMessage(null);
    setError(null);
    const requestKey = credentialKey;
    try {
      const result = await validateAgentCredential(data);
      if (latestCredentialKey.current !== requestKey) return;
      setValidatedKey(requestKey);
      setValidationMessage(result.message);
    } catch (err) {
      if (latestCredentialKey.current !== requestKey) return;
      setValidatedKey(null);
      setError(err instanceof Error ? err.message : 'API key validation failed');
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
      await saveAgentCredential(data);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const selectedDef = selectedAgent ? AGENT_CATALOG.find((a) => a.id === selectedAgent) : null;

  return (
    <div>
      <h3 className="sam-type-section-heading text-fg-primary m-0 mb-1">Connect your AI agent</h3>
      <p className="sam-type-body text-fg-muted m-0 mb-4">
        SAM runs AI coding agents in cloud workspaces. Which agent do you use?
      </p>

      {error && (
        <div className="mb-3">
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {/* Agent selection grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {AGENT_CATALOG.map((agent) => (
          <OptionCard
            key={agent.id}
            name={agent.name}
            description={agent.description}
            isSelected={selectedAgent === agent.id}
            onSelect={() => {
              setSelectedAgent(agent.id);
              setError(null);
              setValidatedKey(null);
              setValidationMessage(null);
            }}
          />
        ))}
      </div>

      {/* API key input */}
      {selectedDef && (
        <div className="mb-4">
          <label htmlFor="agent-api-key" className="block text-sm font-medium text-fg-primary mb-1">
            {selectedDef.name} API Key
          </label>
          <Input
            id="agent-api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setValidatedKey(null);
              setValidationMessage(null);
            }}
            placeholder={`Paste your ${selectedDef.provider} API key`}
          />
          <a
            href={selectedDef.credentialHelpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline mt-1 inline-block"
          >
            Where do I get this?
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
        testDisabled={!selectedAgent || !apiKey.trim() || validating || saving}
        connectDisabled={!selectedAgent || !apiKey.trim() || saving || validating || !isValidated}
        testLabel={getValidateButtonLabel(validating, isValidated)}
        saveLabel={saving ? 'Saving...' : 'Connect'}
      />
    </div>
  );
}
