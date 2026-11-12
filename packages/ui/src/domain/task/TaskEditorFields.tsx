import type { PersonRecord, RepositoryRecord } from '@doru/core';
import { nls } from '../../nls';
import { Field } from '../../atoms/field/Field';
import { FieldGrid } from '../../atoms/field-grid/FieldGrid';
import { Input } from '../../atoms/form/Input';
import { Select } from '../../atoms/form/Select';
import { DateEditor } from '../date/DateEditor';
import { displayName } from '../format/format';
import type { TodoDraft } from './todoDraft';

/**
 * The editable fields of a todo, shared by the task tab editor: the text,
 * the classification fields (category, locality, priority, status), the
 * repository and person links, and the scheduled/reminder dates.
 */
export function TaskEditorFields({
  edit,
  persons,
  repositories,
  onChange,
}: {
  edit: TodoDraft;
  persons: PersonRecord[];
  repositories: RepositoryRecord[];
  onChange: (update: Partial<TodoDraft>) => void;
}) {
  return (
    <>
      <Field label={nls.t('features.tasks.text')}>
        <Input
          value={edit.text}
          placeholder={nls.t('features.tasks.text')}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </Field>
      <FieldGrid columns={2}>
        <Field label={nls.t('features.tasks.category')}>
          <Input
            list="doru-task-categories"
            placeholder={nls.t('features.tasks.category')}
            value={edit.category}
            onChange={(event) => onChange({ category: event.target.value })}
          />
        </Field>
        <Field label={nls.t('features.tasks.locality')}>
          <Input
            list="doru-task-localities"
            placeholder={nls.t('features.tasks.locality')}
            value={edit.locality}
            onChange={(event) => onChange({ locality: event.target.value })}
          />
        </Field>
        <Field label={nls.t('features.tasks.priority')}>
          <Select value={edit.priority} onChange={(event) => onChange({ priority: event.target.value })}>
            <option value="">{nls.t('features.tasks.none')}</option>
            <option value="low">{nls.t('features.tasks.priorityLow')}</option>
            <option value="medium">{nls.t('features.tasks.priorityMedium')}</option>
            <option value="high">{nls.t('features.tasks.priorityHigh')}</option>
          </Select>
        </Field>
        <Field label={nls.t('features.tasks.status')}>
          <Select value={edit.status} onChange={(event) => onChange({ status: event.target.value })}>
            <option value="">{nls.t('features.tasks.statusOpen')}</option>
            <option value="in-progress">{nls.t('features.tasks.statusInProgress')}</option>
            <option value="closed">{nls.t('features.tasks.statusClosed')}</option>
          </Select>
        </Field>
        <Field label={nls.t('features.tasks.repository')}>
          <Select value={edit.repositoryId} onChange={(event) => onChange({ repositoryId: event.target.value })}>
            <option value="">{nls.t('features.tasks.none')}</option>
            {repositories.map((repository) => (
              <option key={repository.id} value={repository.id}>
                {repository.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={nls.t('features.tasks.person')}>
          <Select value={edit.personId} onChange={(event) => onChange({ personId: event.target.value })}>
            <option value="">{nls.t('features.tasks.none')}</option>
            {persons.map((person) => (
              <option key={person.id} value={person.id}>
                {displayName(person)}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>
      <DateEditor
        label={nls.t('features.tasks.scheduled')}
        value={edit.scheduled}
        onChange={(value) => onChange({ scheduled: value })}
        hidePlace
      />
      <DateEditor
        label={nls.t('features.tasks.reminder')}
        value={edit.reminder}
        onChange={(value) => onChange({ reminder: value })}
        hidePlace
      />
    </>
  );
}
