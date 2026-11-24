import { normalizeTaskPriority, normalizeTaskStatus } from '@doru/core/model';
import { nls } from '../../nls';
import { Field } from '../../atoms/field/Field';
import { FieldGrid } from '../../atoms/field-grid/FieldGrid';
import { DateTimePicker } from '../../atoms/date-time-picker/DateTimePicker';
import { Input } from '../../atoms/form/Input';
import { Select } from '../../atoms/form/Select';
import { useAutoFocusSelect } from '../../lib/useAutoFocusSelect';
import { inputToTimestamp, type TaskDraft } from './taskDraft';

/**
 * The editable fields of a task, shared by the task tab editor: the text,
 * the classification fields (priority, status), and the scheduled/reminder
 * instants. Creation and closing timestamps are managed by the service, and
 * the related records are picked in their own final card block.
 */
export function TaskEditorFields({
  edit,
  onChange,
  autoFocusText = false,
}: {
  edit: TaskDraft;
  onChange: (update: Partial<TaskDraft>) => void;
  /** Focuses the task text when a new task tab opens. */
  autoFocusText?: boolean;
}) {
  const textRef = useAutoFocusSelect<HTMLInputElement>(autoFocusText);
  const dateTimeLabels = {
    chooseDate: nls.t('features.tasks.chooseDate'),
    previousMonth: nls.t('features.tasks.previousMonth'),
    nextMonth: nls.t('features.tasks.nextMonth'),
    today: nls.t('features.tasks.today'),
    clear: nls.t('features.tasks.clear'),
  };
  const invalidTimestamp = nls.t('features.tasks.invalidTimestamp');
  const scheduledInvalid = edit.scheduledAt.trim() !== '' && inputToTimestamp(edit.scheduledAt) === undefined;
  const reminderInvalid = edit.reminderAt.trim() !== '' && inputToTimestamp(edit.reminderAt) === undefined;

  return (
    <>
      <Field label={nls.t('features.tasks.text')}>
        <Input
          ref={textRef}
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
        <Field label={nls.t('features.tasks.scheduled')} {...(scheduledInvalid ? { error: invalidTimestamp } : {})}>
          <DateTimePicker
            value={edit.scheduledAt}
            onChange={(value) => onChange({ scheduledAt: value })}
            locale={nls.locale}
            labels={dateTimeLabels}
          />
        </Field>
        <Field label={nls.t('features.tasks.reminder')} {...(reminderInvalid ? { error: invalidTimestamp } : {})}>
          <DateTimePicker
            value={edit.reminderAt}
            onChange={(value) => onChange({ reminderAt: value })}
            locale={nls.locale}
            labels={dateTimeLabels}
          />
        </Field>
      </FieldGrid>
    </>
  );
}
