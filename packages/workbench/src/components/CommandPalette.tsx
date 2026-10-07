import { useMemo, useState, type KeyboardEvent } from 'react';
import type { CommandService } from '@doru/platform';
import { nls } from '../nls';

export interface CommandPaletteProps {
  commands: CommandService;
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ commands, open, onClose }: CommandPaletteProps) {
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return commands
      .all()
      .filter((command) => !needle || command.title.toLowerCase().includes(needle));
  }, [commands, filter]);

  if (!open) {
    return null;
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'ArrowDown') {
      setActive((value) => Math.min(value + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      setActive((value) => Math.max(value - 1, 0));
    } else if (event.key === 'Enter') {
      const match = matches[active];
      if (match) {
        void commands.execute(match.id);
        onClose();
      }
    }
  };

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={(event) => event.stopPropagation()}>
        <input
          autoFocus
          className="command-palette-input"
          placeholder={nls.t('workbench.commandPalette.placeholder')}
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <ul className="command-palette-list">
          {matches.length === 0 ? (
            <li className="command-palette-empty">{nls.t('workbench.commandPalette.empty')}</li>
          ) : (
            matches.map((command, index) => (
              <li
                key={command.id}
                className={index === active ? 'command-palette-item active' : 'command-palette-item'}
                onMouseEnter={() => setActive(index)}
                onClick={() => {
                  void commands.execute(command.id);
                  onClose();
                }}
              >
                {command.title}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
