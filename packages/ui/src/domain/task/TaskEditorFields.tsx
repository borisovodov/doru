import { TARGET_TYPES } from '@doru/core/model';
import { nls } from '../../nls';
import { Field } from '../../atoms/field/Field';
import { FieldGrid } from '../../atoms/field-grid/FieldGrid';
import { Input } from '../../atoms/form/Input';
import { Select } from '../../atoms/form/Select';
import { DateEditor } from '../date/DateEditor';
import type { TaskTargetData } from './taskTargets';
import { taskTargetOptions } from './taskTargets';
import type { TodoDraft } from './todoDraft';

/**
 * The editable fields of a todo, shared by the task tab editor: the text,
 * the classification fields (category, locality, priority, status), the
 * repository and entity links, and the creation/scheduled/reminder/closed
 * dates. `data` carries every record type a task can be related to.
 */
export function TaskEditorFields({
  edit,
  data,
  onChange,
}: {
  edit: TodoDraft;
  data: TaskTargetData;
  onChange: (update: Partial<TodoDraft>) => void;
}) {
  const knownTarget = (TARGET_TYPES as readonly string[]).includes(edit.targetType);
  const targetOptions = taskTargetOptions(edit.targetType, data);
  const knownTargetId = targetOptions.some((option) => option.id === edit.targetId);

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
            {data.repositories.map((repository) => (
              <option key={repository.id} value={repository.id}>
                {repository.name}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>
      <FieldGrid columns={2}>
        <Field label={nls.t('features.tasks.target')}>
          <Select
            value={edit.targetType}
            onChange={(event) =>
              onChange({
                targetType: event.target.value,
                ...(event.target.value === edit.targetType ? {} : { targetId: '' }),
              })
            }
          >
            <option value="">{nls.t('features.tasks.none')}</option>
            {TARGET_TYPES.map((type) => (
              <option key={type} value={type}>
                {nls.t(`features.tasks.target.${type}`)}
              </option>
            ))}
            {!knownTarget && edit.targetType !== '' && <option value={edit.targetType}>{edit.targetType}</option>}
          </Select>
        </Field>
        <Field label={nls.t('features.tasks.targetRecord')}>
          <Select
            value={edit.targetId}
            disabled={edit.targetType === ''}
            onChange={(event) => onChange({ targetId: event.target.value })}
          >
            <option value="">{nls.t('features.tasks.none')}</option>
            {edit.targetId !== '' && !knownTargetId && <option value={edit.targetId}>{edit.targetId}</option>}
            {targetOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>
      <DateEditor
        label={nls.t('features.tasks.created')}
        value={edit.created}
        onChange={(value) => onChange({ created: value })}
        hidePlace
      />
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
      <DateEditor
        label={nls.t('features.tasks.closed')}
        value={edit.closed}
        onChange={(value) => onChange({ closed: value })}
        hidePlace
      />
    </>
  );
}
