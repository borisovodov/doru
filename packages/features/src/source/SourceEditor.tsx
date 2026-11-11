import { useState } from 'react';
import { BookOpenText, Plus, X } from 'lucide-react';
import type { RepositoryRecord } from '@doru/core';
import { nls } from '../nls';
import '../sidebar/sidebar.css';
import './SourceEditor.css';
import { DateEditor } from '../person/DateEditor';
import { emptyDate } from '../person/draft';
import {
  emptySourceTextDraft,
  type CallNumberDraft,
  type SourceDataEventDraft,
  type SourceDraft,
  type SourceRepositoryDraft,
  type SourceTextDraft,
  type TemplateFieldDraft,
} from './sourceDraft';

/**
 * The full source form: bibliographic details, publication, text extracts,
 * recorded events, repository copies with call numbers and template
 * fields. The save/cancel/delete actions live on the card, like the
 * person editor.
 */
export function SourceEditor({
  draft,
  onChange,
  repositories,
  onAddRepository,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: SourceDraft;
  onChange: (draft: SourceDraft) => void;
  repositories: RepositoryRecord[];
  onAddRepository: (repository: RepositoryRecord) => Promise<void>;
  onSave: () => void;
  onCancel?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}) {
  const set = (patch: Partial<SourceDraft>) => onChange({ ...draft, ...patch });

  const patchText = (index: number, values: Partial<SourceTextDraft>) =>
    set({ texts: draft.texts.map((text, i) => (i === index ? { ...text, ...values } : text)) });
  const addText = () => set({ texts: [...draft.texts, emptySourceTextDraft()] });
  const removeText = (index: number) => set({ texts: draft.texts.filter((_, i) => i !== index) });

  const patchEvent = (index: number, values: Partial<SourceDataEventDraft>) =>
    set({ dataEvents: draft.dataEvents.map((event, i) => (i === index ? { ...event, ...values } : event)) });
  const addEvent = () => set({ dataEvents: [...draft.dataEvents, { id: crypto.randomUUID(), tag: '', value: '', date: emptyDate() }] });
  const removeEvent = (index: number) => set({ dataEvents: draft.dataEvents.filter((_, i) => i !== index) });

  const patchRepository = (index: number, values: Partial<SourceRepositoryDraft>) =>
    set({ repositories: draft.repositories.map((link, i) => (i === index ? { ...link, ...values } : link)) });
  const addRepository = () => set({ repositories: [...draft.repositories, { id: crypto.randomUUID(), repositoryId: '', callNumbers: [] }] });
  const removeRepository = (index: number) => set({ repositories: draft.repositories.filter((_, i) => i !== index) });

  const patchCallNumber = (repositoryIndex: number, callNumberIndex: number, values: Partial<CallNumberDraft>) =>
    patchRepository(repositoryIndex, {
      callNumbers: draft.repositories[repositoryIndex]!.callNumbers.map((callNumber, i) =>
        i === callNumberIndex ? { ...callNumber, ...values } : callNumber,
      ),
    });
  const addCallNumber = (repositoryIndex: number) =>
    patchRepository(repositoryIndex, {
      callNumbers: [...draft.repositories[repositoryIndex]!.callNumbers, { id: crypto.randomUUID(), value: '', medium: '' }],
    });
  const removeCallNumber = (repositoryIndex: number, callNumberIndex: number) =>
    patchRepository(repositoryIndex, {
      callNumbers: draft.repositories[repositoryIndex]!.callNumbers.filter((_, i) => i !== callNumberIndex),
    });

  const patchField = (index: number, values: Partial<TemplateFieldDraft>) =>
    set({ templateFields: draft.templateFields.map((field, i) => (i === index ? { ...field, ...values } : field)) });
  const addField = () => set({ templateFields: [...draft.templateFields, { id: crypto.randomUUID(), name: '', value: '' }] });
  const removeField = (index: number) => set({ templateFields: draft.templateFields.filter((_, i) => i !== index) });

  const subtitle = [draft.author.trim(), draft.publication.trim()].filter((part) => part !== '').join(' · ');

  return (
    <div className="source-editor">
      <section className="entity-view-card">
        <span className="entity-card-icon entity-view-icon">
          <BookOpenText size={20} aria-hidden="true" />
        </span>
        <div className="entity-view-body">
          <h2 className="entity-view-title">{draft.title.trim() || '—'}</h2>
          {subtitle !== '' && <p className="entity-view-subtitle">{subtitle}</p>}
          {draft.abbreviation.trim() !== '' && <p className="entity-view-subtitle">{draft.abbreviation.trim()}</p>}
        </div>
        <div className="person-view-actions">
          <button className="primary" onClick={onSave}>
            {nls.t('features.tree.save')}
          </button>
          {onCancel && <button onClick={onCancel}>{nls.t('features.tree.back')}</button>}
          {onDelete && (
            <button className="source-delete-button" onClick={onDelete}>
              {nls.t('features.tree.fact.delete')}
            </button>
          )}
        </div>
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.source.details')}</h3>
        <label>
          {nls.t('features.tree.sources.titleField')}
          <input value={draft.title} onChange={(event) => set({ title: event.target.value })} />
        </label>
        <div className="source-grid">
          <label>
            {nls.t('features.tree.sources.authorField')}
            <input value={draft.author} onChange={(event) => set({ author: event.target.value })} />
          </label>
          <label>
            {nls.t('features.tree.source.publication')}
            <input value={draft.publication} onChange={(event) => set({ publication: event.target.value })} />
          </label>
          <label>
            {nls.t('features.tree.source.abbreviation')}
            <input value={draft.abbreviation} onChange={(event) => set({ abbreviation: event.target.value })} />
          </label>
          <label>
            {nls.t('features.tree.source.medium')}
            <input value={draft.medium} onChange={(event) => set({ medium: event.target.value })} />
          </label>
          <label>
            {nls.t('features.tree.source.url')}
            <input value={draft.url} onChange={(event) => set({ url: event.target.value })} />
          </label>
          <label>
            {nls.t('features.tree.source.accessDate')}
            <input value={draft.accessDate} onChange={(event) => set({ accessDate: event.target.value })} />
          </label>
          <label>
            {nls.t('features.tree.source.confidence')}
            <input value={draft.confidence} onChange={(event) => set({ confidence: event.target.value })} />
          </label>
          <label>
            {nls.t('features.tree.source.agency')}
            <input value={draft.agency} onChange={(event) => set({ agency: event.target.value })} />
          </label>
        </div>
        <DateEditor
          label={nls.t('features.tree.source.pubDate')}
          value={draft.pubDate}
          onChange={(pubDate) => set({ pubDate })}
        />
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.source.texts')}</h3>
        {draft.texts.map((text, index) => (
          <div className="source-text-block" key={text.id}>
            <textarea
              value={text.text}
              placeholder={nls.t('features.tree.source.texts')}
              onChange={(event) => patchText(index, { text: event.target.value })}
            />
            <div className="source-sub-row">
              <input
                placeholder={nls.t('features.tree.source.texts.language')}
                value={text.language}
                onChange={(event) => patchText(index, { language: event.target.value })}
              />
              <input
                placeholder={nls.t('features.tree.source.texts.mime')}
                value={text.mime}
                onChange={(event) => patchText(index, { mime: event.target.value })}
              />
              <button
                className="icon-button"
                title={nls.t('features.tree.source.texts.remove')}
                onClick={() => removeText(index)}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
        <button className="add-button" onClick={addText}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.source.texts.add')}
        </button>
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.source.dataEvents')}</h3>
        {draft.dataEvents.map((event, index) => (
          <div className="source-event-block" key={event.id}>
            <div className="source-sub-row">
              <input
                placeholder={nls.t('features.tree.source.dataEvents.tag')}
                value={event.tag}
                onChange={(change) => patchEvent(index, { tag: change.target.value.toUpperCase() })}
              />
              <input
                placeholder={nls.t('features.tree.source.dataEvents.value')}
                value={event.value}
                onChange={(change) => patchEvent(index, { value: change.target.value })}
              />
              <button
                className="icon-button"
                title={nls.t('features.tree.source.dataEvents.remove')}
                onClick={() => removeEvent(index)}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
            <DateEditor
              label={nls.t('features.tree.events.dateField')}
              value={event.date}
              onChange={(date) => patchEvent(index, { date })}
              hidePlace
            />
          </div>
        ))}
        <button className="add-button" onClick={addEvent}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.source.dataEvents.add')}
        </button>
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.source.repositories')}</h3>
        {draft.repositories.map((link, index) => (
          <div className="source-repository-block" key={link.id}>
            <div className="source-sub-row">
              <select
                value={link.repositoryId}
                onChange={(event) => patchRepository(index, { repositoryId: event.target.value })}
              >
                <option value="">{nls.t('features.tree.source.repositories.none')}</option>
                {repositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.name}
                  </option>
                ))}
              </select>
              <button
                className="icon-button"
                title={nls.t('features.tree.source.repositories.remove')}
                onClick={() => removeRepository(index)}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
            {link.callNumbers.map((callNumber, callNumberIndex) => (
              <div className="source-sub-row source-call-number" key={callNumber.id}>
                <input
                  placeholder={nls.t('features.tree.source.repositories.callNumbers.value')}
                  value={callNumber.value}
                  onChange={(event) => patchCallNumber(index, callNumberIndex, { value: event.target.value })}
                />
                <input
                  placeholder={nls.t('features.tree.source.repositories.callNumbers.medium')}
                  value={callNumber.medium}
                  onChange={(event) => patchCallNumber(index, callNumberIndex, { medium: event.target.value })}
                />
                <button
                  className="icon-button"
                  title={nls.t('features.tree.source.repositories.callNumbers.remove')}
                  onClick={() => removeCallNumber(index, callNumberIndex)}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button className="add-button small" onClick={() => addCallNumber(index)}>
              <Plus size={13} aria-hidden="true" />
              {nls.t('features.tree.source.repositories.callNumbers.add')}
            </button>
          </div>
        ))}
        <div className="source-actions">
          <button className="add-button" onClick={addRepository}>
            <Plus size={13} aria-hidden="true" />
            {nls.t('features.tree.source.repositories.add')}
          </button>
          <NewRepositoryInput onAddRepository={onAddRepository} />
        </div>
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.source.templateFields')}</h3>
        {draft.templateFields.map((field, index) => (
          <div className="source-sub-row" key={field.id}>
            <input
              placeholder={nls.t('features.tree.source.templateFields.name')}
              value={field.name}
              onChange={(event) => patchField(index, { name: event.target.value })}
            />
            <input
              placeholder={nls.t('features.tree.source.templateFields.value')}
              value={field.value}
              onChange={(event) => patchField(index, { value: event.target.value })}
            />
            <button
              className="icon-button"
              title={nls.t('features.tree.source.templateFields.remove')}
              onClick={() => removeField(index)}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button className="add-button" onClick={addField}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.source.templateFields.add')}
        </button>
      </section>
    </div>
  );
}

/** Creates a repository by name only — the full repository editor comes later. */
function NewRepositoryInput({ onAddRepository }: { onAddRepository: (repository: RepositoryRecord) => Promise<void> }) {
  const [name, setName] = useState('');
  const create = async () => {
    const trimmed = name.trim();
    if (trimmed === '') {
      return;
    }
    await onAddRepository({ id: crypto.randomUUID(), name: trimmed });
    setName('');
  };
  return (
    <div className="source-sub-row new-repository">
      <input
        placeholder={nls.t('features.tree.source.repositories.new')}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button className="plain-button" onClick={() => void create()}>
        {nls.t('features.tree.source.repositories.create')}
      </button>
    </div>
  );
}
