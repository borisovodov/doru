import { normalizeTaskPriority, normalizeTaskStatus, TARGET_TYPES, type TargetType } from '@doru/core/model';
import { nls } from '../../nls';
import { Field } from '../../atoms/field/Field';
import { FieldGrid } from '../../atoms/field-grid/FieldGrid';
import { Input } from '../../atoms/form/Input';
import { Select } from '../../atoms/form/Select';
import type { TaskTargetData } from './taskTargets';
import { taskTargetLabel, taskTargetOptions } from './taskTargets';
import type { TaskDraft } from './taskDraft';

/**
 * The editable fields of a task, shared by the task tab editor: the text,
 * the classification fields (priority, status), the entity links, and the
 * scheduled/reminder instants. `data` carries every record type a task can
 * be related to. Creation and closing timestamps are managed by the service.
 */
export function TaskEditorFields({
  edit,
  data,
  onChange,
  targetTypes = TARGET_TYPES,
}: {
  edit: TaskDraft;
  data: TaskTargetData;
  onChange: (update: Partial<TaskDraft>) => void;
  /** The target types offered by the picker; stored targets outside it stay visible. */
  targetTypes?: readonly TargetType[];
}) {
  const knownTarget = (targetTypes as readonly string[]).includes(edit.targetType);
  // A stored target outside the offered types (e.g. media while its editor is
  // hidden) stays visible as a single read-only reference.
  const targetOptions = knownTarget ? taskTargetOptions(edit.targetType, data) : [];
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
        <Field label={nls.t('features.tasks.priority')}>
          <Select
            value={edit.priority}
            onChange={(event) => onChange({ priority: normalizeTaskPriority(event.target.value) })}
          >
            <option value="low">{nls.t('features.tasks.priorityLow')}</option>
            <option value="medium">{nls.t('features.tasks.priorityMedium')}</option>
            <option value="high">{nls.t('features.tasks.priorityHigh')}</option>
          </Select>
        </Field>
        <Field label={nls.t('features.tasks.status')}>
          <Select
            value={edit.status}
            onChange={(event) => onChange({ status: normalizeTaskStatus(event.target.value) })}
          >
            <option value="open">{nls.t('features.tasks.statusOpen')}</option>
            <option value="waiting">{nls.t('features.tasks.statusWaiting')}</option>
            <option value="in-progress">{nls.t('features.tasks.statusInProgress')}</option>
            <option value="closed">{nls.t('features.tasks.statusClosed')}</option>
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
            {targetTypes.map((type) => (
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
            disabled={edit.targetType === '' || !knownTarget}
            onChange={(event) => onChange({ targetId: event.target.value })}
          >
            <option value="">{nls.t('features.tasks.none')}</option>
            {!knownTarget && edit.targetId !== '' && (
              <option value={edit.targetId}>{taskTargetLabel(edit.targetType, edit.targetId, data)}</option>
            )}
            {knownTarget && edit.targetId !== '' && !knownTargetId && (
              <option value={edit.targetId}>{edit.targetId}</option>
            )}
            {targetOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>
      <FieldGrid columns={2}>
        <Field label={nls.t('features.tasks.scheduled')}>
          <Input
            type="datetime-local"
            value={edit.scheduledAt}
            onChange={(event) => onChange({ scheduledAt: event.target.value })}
          />
        </Field>
        <Field label={nls.t('features.tasks.reminder')}>
          <Input
            type="datetime-local"
            value={edit.reminderAt}
            onChange={(event) => onChange({ reminderAt: event.target.value })}
          />
        </Field>
      </FieldGrid>
    </>
  );
}
