import { IconButton } from '@doru/ui';
import { useState } from 'react';
import { Input } from '@doru/ui';
import { Select, Textarea } from '@doru/ui';
import { SectionCard, Subcard } from '@doru/ui';
import { Field, FieldGrid } from '@doru/ui';
import { BookOpenText, Plus, X } from 'lucide-react';
import type { PlaceRecord, RepositoryRecord, TitleRecord } from '@doru/core';
import { placeName } from '@doru/core/model';
import { nls } from '../nls';
import '../sidebar/sidebar.css';
import './SourceEditor.css';
import { DateEditor, emptyDate } from '@doru/ui/domain';
import { Button } from '@doru/ui';
import { EditorPage, EntityViewCard } from '@doru/ui';
import {
  emptySourceTextDraft,
  type CallNumberDraft,
  type SourceDataEventDraft,
  type SourceDraft,
  type SourceRepositoryDraft,
  type SourceTextDraft,
  type TemplateFieldDraft,
} from '@doru/ui/domain';

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
  titles,
  places,
  onAddRepository,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: SourceDraft;
  onChange: (draft: SourceDraft) => void;
  repositories: RepositoryRecord[];
  titles: TitleRecord[];
  places: PlaceRecord[];
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
  const addEvent = () =>
    set({ dataEvents: [...draft.dataEvents, { id: crypto.randomUUID(), tag: '', value: '', date: emptyDate() }] });
  const removeEvent = (index: number) => set({ dataEvents: draft.dataEvents.filter((_, i) => i !== index) });

  const patchRepository = (index: number, values: Partial<SourceRepositoryDraft>) =>
    set({ repositories: draft.repositories.map((link, i) => (i === index ? { ...link, ...values } : link)) });
  const addRepository = () =>
    set({ repositories: [...draft.repositories, { id: crypto.randomUUID(), repositoryId: '', callNumbers: [] }] });
  const removeRepository = (index: number) => set({ repositories: draft.repositories.filter((_, i) => i !== index) });

  const patchCallNumber = (repositoryIndex: number, callNumberIndex: number, values: Partial<CallNumberDraft>) => {
    const repository = draft.repositories[repositoryIndex];
    if (repository === undefined) {
      return;
    }
    patchRepository(repositoryIndex, {
      callNumbers: repository.callNumbers.map((callNumber, i) =>
        i === callNumberIndex ? { ...callNumber, ...values } : callNumber,
      ),
    });
  };
  const addCallNumber = (repositoryIndex: number) => {
    const repository = draft.repositories[repositoryIndex];
    if (repository === undefined) {
      return;
    }
    patchRepository(repositoryIndex, {
      callNumbers: [...repository.callNumbers, { id: crypto.randomUUID(), value: '', medium: '' }],
    });
  };
  const removeCallNumber = (repositoryIndex: number, callNumberIndex: number) => {
    const repository = draft.repositories[repositoryIndex];
    if (repository === undefined) {
      return;
    }
    patchRepository(repositoryIndex, {
      callNumbers: repository.callNumbers.filter((_, i) => i !== callNumberIndex),
    });
  };

  const patchField = (index: number, values: Partial<TemplateFieldDraft>) =>
    set({ templateFields: draft.templateFields.map((field, i) => (i === index ? { ...field, ...values } : field)) });
  const addField = () =>
    set({ templateFields: [...draft.templateFields, { id: crypto.randomUUID(), name: '', value: '' }] });
  const removeField = (index: number) => set({ templateFields: draft.templateFields.filter((_, i) => i !== index) });

  const subtitle = [draft.author.trim(), draft.publication.trim()].filter((part) => part !== '').join(' · ');

  return (
    <EditorPage label={nls.t('features.tree.sources.title')}>
      <EntityViewCard
        media={<BookOpenText size={20} aria-hidden="true" />}
        title={draft.title.trim() || '—'}
        subtitle={
          <>
            {subtitle !== '' ? subtitle : null}
            {subtitle !== '' && draft.abbreviation.trim() !== '' ? <br /> : null}
            {draft.abbreviation.trim() !== '' ? draft.abbreviation.trim() : null}
          </>
        }
        actions={
          <>
            <Button variant="primary" size="sm" onClick={onSave}>
              {nls.t('features.tree.save')}
            </Button>
            {onCancel && (
              <Button variant="secondary" size="sm" onClick={onCancel}>
                {nls.t('features.tree.back')}
              </Button>
            )}
            {onDelete && (
              <Button variant="danger" size="sm" onClick={onDelete}>
                {nls.t('features.tree.fact.delete')}
              </Button>
            )}
          </>
        }
      />

      <SectionCard title={nls.t('features.tree.source.details')}>
        <Field label={nls.t('features.tree.sources.titleField')}>
          <Input value={draft.title} onChange={(event) => set({ title: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.title.work')}>
          <Select
            value={draft.titleId ?? ''}
            onChange={(event) => set({ titleId: event.target.value === '' ? undefined : event.target.value })}
          >
            <option value="">{nls.t('features.tree.title.none')}</option>
            {titles.map((title) => (
              <option key={title.id} value={title.id}>
                {title.name ?? title.id}
              </option>
            ))}
          </Select>
        </Field>
        <FieldGrid columns={2}>
          <Field label={nls.t('features.tree.sources.authorField')}>
            <Input value={draft.author} onChange={(event) => set({ author: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.source.publication')}>
            <Input value={draft.publication} onChange={(event) => set({ publication: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.source.abbreviation')}>
            <Input value={draft.abbreviation} onChange={(event) => set({ abbreviation: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.source.medium')}>
            <Input value={draft.medium} onChange={(event) => set({ medium: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.source.url')}>
            <Input value={draft.url} onChange={(event) => set({ url: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.source.accessDate')}>
            <Input value={draft.accessDate} onChange={(event) => set({ accessDate: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.source.confidence')}>
            <Input value={draft.confidence} onChange={(event) => set({ confidence: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.source.agency')}>
            <Input value={draft.agency} onChange={(event) => set({ agency: event.target.value })} />
          </Field>
        </FieldGrid>
        <DateEditor
          label={nls.t('features.tree.source.pubDate')}
          value={draft.pubDate}
          onChange={(pubDate) => set({ pubDate })}
        />
        <Field label={nls.t('features.tree.fact.placeLink')}>
          <Select
            value={places.find((place) => placeName(place) === draft.pubDate.place.trim())?.id ?? ''}
            onChange={(event) => {
              const place = places.find((entry) => entry.id === event.target.value);
              if (place) {
                set({ pubDate: { ...draft.pubDate, place: placeName(place) } });
              }
            }}
          >
            <option value="">{nls.t('features.tree.fact.placeLink.none')}</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {placeName(place)}
              </option>
            ))}
          </Select>
        </Field>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.source.texts')}>
        {draft.texts.map((text, index) => (
          <Subcard key={text.id}>
            <Textarea
              value={text.text}
              placeholder={nls.t('features.tree.source.texts')}
              onChange={(event) => patchText(index, { text: event.target.value })}
            />
            <div className="source-sub-row">
              <Input
                placeholder={nls.t('features.tree.source.texts.language')}
                value={text.language}
                onChange={(event) => patchText(index, { language: event.target.value })}
              />
              <Input
                placeholder={nls.t('features.tree.source.texts.mime')}
                value={text.mime}
                onChange={(event) => patchText(index, { mime: event.target.value })}
              />
              <IconButton
                size="sm"
                label={nls.t('features.tree.source.texts.remove')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => removeText(index)}
              />
            </div>
          </Subcard>
        ))}
        <Button variant="primary" onClick={addText}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.source.texts.add')}
        </Button>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.source.dataEvents')}>
        {draft.dataEvents.map((event, index) => (
          <Subcard key={event.id}>
            <div className="source-sub-row">
              <Input
                placeholder={nls.t('features.tree.source.dataEvents.tag')}
                value={event.tag}
                onChange={(change) => patchEvent(index, { tag: change.target.value.toUpperCase() })}
              />
              <Input
                placeholder={nls.t('features.tree.source.dataEvents.value')}
                value={event.value}
                onChange={(change) => patchEvent(index, { value: change.target.value })}
              />
              <IconButton
                size="sm"
                label={nls.t('features.tree.source.dataEvents.remove')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => removeEvent(index)}
              />
            </div>
            <DateEditor
              label={nls.t('features.tree.events.dateField')}
              value={event.date}
              onChange={(date) => patchEvent(index, { date })}
              hidePlace
            />
            <Field label={nls.t('features.tree.fact.placeLink')}>
              <Select
                value={event.placeId ?? ''}
                onChange={(change) => {
                  const place = places.find((entry) => entry.id === change.target.value);
                  patchEvent(index, { placeId: place?.id });
                }}
              >
                <option value="">{nls.t('features.tree.fact.placeLink.none')}</option>
                {places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {placeName(place)}
                  </option>
                ))}
              </Select>
            </Field>
          </Subcard>
        ))}
        <Button variant="primary" onClick={addEvent}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.source.dataEvents.add')}
        </Button>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.source.repositories')}>
        {draft.repositories.map((link, index) => (
          <Subcard key={link.id}>
            <div className="source-sub-row">
              <Select
                value={link.repositoryId}
                onChange={(event) => patchRepository(index, { repositoryId: event.target.value })}
              >
                <option value="">{nls.t('features.tree.source.repositories.none')}</option>
                {repositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.name}
                  </option>
                ))}
              </Select>
              <IconButton
                size="sm"
                label={nls.t('features.tree.source.repositories.remove')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => removeRepository(index)}
              />
            </div>
            {link.callNumbers.map((callNumber, callNumberIndex) => (
              <div className="source-sub-row source-call-number" key={callNumber.id}>
                <Input
                  placeholder={nls.t('features.tree.source.repositories.callNumbers.value')}
                  value={callNumber.value}
                  onChange={(event) => patchCallNumber(index, callNumberIndex, { value: event.target.value })}
                />
                <Input
                  placeholder={nls.t('features.tree.source.repositories.callNumbers.medium')}
                  value={callNumber.medium}
                  onChange={(event) => patchCallNumber(index, callNumberIndex, { medium: event.target.value })}
                />
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.source.repositories.callNumbers.remove')}
                  icon={<X size={13} aria-hidden="true" />}
                  onClick={() => removeCallNumber(index, callNumberIndex)}
                />
              </div>
            ))}
            <Button variant="primary" size="sm" onClick={() => addCallNumber(index)}>
              <Plus size={13} aria-hidden="true" />
              {nls.t('features.tree.source.repositories.callNumbers.add')}
            </Button>
          </Subcard>
        ))}
        <div className="source-actions">
          <Button variant="primary" onClick={addRepository}>
            <Plus size={13} aria-hidden="true" />
            {nls.t('features.tree.source.repositories.add')}
          </Button>
          <NewRepositoryInput onAddRepository={onAddRepository} />
        </div>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.source.templateFields')}>
        {draft.templateFields.map((field, index) => (
          <div className="source-sub-row" key={field.id}>
            <Input
              placeholder={nls.t('features.tree.source.templateFields.name')}
              value={field.name}
              onChange={(event) => patchField(index, { name: event.target.value })}
            />
            <Input
              placeholder={nls.t('features.tree.source.templateFields.value')}
              value={field.value}
              onChange={(event) => patchField(index, { value: event.target.value })}
            />
            <IconButton
              size="sm"
              label={nls.t('features.tree.source.templateFields.remove')}
              icon={<X size={13} aria-hidden="true" />}
              onClick={() => removeField(index)}
            />
          </div>
        ))}
        <Button variant="primary" onClick={addField}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.source.templateFields.add')}
        </Button>
      </SectionCard>
    </EditorPage>
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
      <Input
        placeholder={nls.t('features.tree.source.repositories.new')}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Button variant="secondary" onClick={() => void create()}>
        {nls.t('features.tree.source.repositories.create')}
      </Button>
    </div>
  );
}
