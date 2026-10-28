import { Button } from '../../components/ui/Button';

interface Props {
  started: boolean;
  onStart: () => void;
  onReset: () => void;
}

export function AppHeader({ started, onStart, onReset }: Props) {
  return (
    <header className="app-header">
      <h1 className="app-title">تمريني</h1>
      <div className="app-header__actions">
        {!started ? (
          <Button variant="primary" onClick={onStart}>
            بدء البرنامج
          </Button>
        ) : null}
        <Button variant="quiet" icon="rotate" onClick={onReset}>
          إعادة البرنامج
        </Button>
      </div>
    </header>
  );
}
