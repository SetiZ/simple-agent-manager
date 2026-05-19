import { Button } from '@simple-agent-manager/ui';

interface CompleteStateProps {
  description: string;
  onContinue: () => void;
  title: string;
}

interface OptionCardProps {
  description: string;
  isSelected: boolean;
  name: string;
  onSelect: () => void;
}

interface StepActionsProps {
  connectDisabled: boolean;
  onSave: () => void;
  onSkip: () => void;
  onValidate: () => void;
  saveLabel: string;
  testDisabled: boolean;
  testLabel: string;
}

export function CompleteState({ description, onContinue, title }: Readonly<CompleteStateProps>) {
  return (
    <div className="text-center py-6">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 mb-3">
        <span className="text-success text-xl">{'\u2713'}</span>
      </div>
      <p className="sam-type-body text-fg-primary font-medium m-0 mb-1">{title}</p>
      <p className="sam-type-caption text-fg-muted m-0">{description}</p>
      <div className="mt-4">
        <Button variant="primary" size="md" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

export function OptionCard({ description, isSelected, name, onSelect }: Readonly<OptionCardProps>) {
  const stateClass = isSelected
    ? 'border-accent ring-1 ring-accent'
    : 'border-border-default hover:border-fg-muted';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`p-3 rounded-md border text-left transition-colors cursor-pointer bg-surface ${stateClass}`}
    >
      <span className="block font-medium text-sm text-fg-primary">{name}</span>
      <span className="block text-xs text-fg-muted mt-0.5">{description}</span>
    </button>
  );
}

export function StepActions({
  connectDisabled,
  onSave,
  onSkip,
  onValidate,
  saveLabel,
  testDisabled,
  testLabel,
}: Readonly<StepActionsProps>) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onSkip}
        className="self-start text-sm text-fg-muted hover:text-fg-primary bg-transparent border-none cursor-pointer p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Skip this step
      </button>
      <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
        <Button variant="secondary" size="md" onClick={onValidate} disabled={testDisabled}>
          {testLabel}
        </Button>
        <Button variant="primary" size="md" onClick={onSave} disabled={connectDisabled}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
