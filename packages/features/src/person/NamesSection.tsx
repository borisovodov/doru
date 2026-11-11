import { Plus, Star, X } from 'lucide-react';
import { nls } from '../nls';
import { DateEditor } from './DateEditor';
import {
  NAME_PART_FIELDS,
  NAME_TYPES,
  NAME_VARIANT_KINDS,
  emptyDate,
  emptyNameDraft,
  emptyVariantDraft,
  nameDraftDisplay,
  partOf,
  setPartValue,
  type DateDraft,
  type NameDraft,
  type NameVariantDraft,
} from './draft';
import './NamesSection.css';

/**
 * The editable list of a person's names: each name block carries its type,
 * language, the name-part fields and (for imported names) the verbatim
 * display form; name variants (translations, phonetic and romanized forms)
 * nest inside their base name.
 */
export function NamesSection({
  names,
  onChange,
}: {
  names: NameDraft[];
  onChange: (names: NameDraft[]) => void;
}) {
  const patch = (index: number, values: Partial<NameDraft>) =>
    onChange(names.map((name, i) => (i === index ? { ...name, ...values } : name)));

  const addName = () => onChange([...names, emptyNameDraft()]);

  const removeName = (index: number) => onChange(names.filter((_, i) => i !== index));

  /**
   * Marks the name as the primary one: the flag moves with it to the front
   * of the list, the position the display name is read from.
   */
  const markPrimary = (index: number) => {
    const target: NameDraft = { ...names[index]!, primary: true };
    const others = names.map((name, i) => (i === index ? target : { ...name, primary: false }));
    onChange([target, ...others.filter((name) => name.id !== target.id)]);
  };

  const patchVariant = (nameIndex: number, variantIndex: number, values: Partial<NameVariantDraft>) => {
    const name = names[nameIndex]!;
    patch(nameIndex, {
      variants: name.variants.map((variant, i) => (i === variantIndex ? { ...variant, ...values } : variant)),
    });
  };

  /** An emptied date row drops the name's validity period entirely. */
  const setDate = (index: number, date: DateDraft) => {
    const emptied = dateDraftBlank(date);
    patch(index, { date: emptied ? undefined : date });
  };

  const addVariant = (nameIndex: number) => {
    const name = names[nameIndex]!;
    patch(nameIndex, { variants: [...name.variants, emptyVariantDraft()] });
  };

  const removeVariant = (nameIndex: number, variantIndex: number) => {
    const name = names[nameIndex]!;
    patch(nameIndex, { variants: name.variants.filter((_, i) => i !== variantIndex) });
  };

  const setVariantDate = (nameIndex: number, variantIndex: number, date: DateDraft) =>
    patchVariant(nameIndex, variantIndex, { date: dateDraftBlank(date) ? undefined : date });

  return (
    <div className="names-section">
      {names.map((name, index) => (
        <div className="name-block" key={name.id}>
          <div className="name-block-head">
            <span className="name-block-label">{nameDraftDisplay(name) || '—'}</span>
            <button
              className={`icon-button${name.primary ? ' is-primary' : ''}`}
              title={nls.t('features.tree.names.primary')}
              onClick={() => markPrimary(index)}
            >
              <Star size={14} fill={name.primary ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
            <button className="icon-button" title={nls.t('features.tree.names.remove')} onClick={() => removeName(index)}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="name-meta-row">
            <label>
              {nls.t('features.tree.names.type')}
              <select value={name.type} onChange={(event) => patch(index, { type: event.target.value })}>
                <option value="">{nls.t('features.tree.names.type.none')}</option>
                {NAME_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {nls.t(`features.tree.names.type.${type}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {nls.t('features.tree.names.language')}
              <input value={name.language} onChange={(event) => patch(index, { language: event.target.value })} />
            </label>
          </div>
          <DateEditor
            label={nls.t('features.tree.names.date')}
            value={name.date ?? emptyDate()}
            onChange={(date) => setDate(index, date)}
            hidePlace
          />
          {partOf(name, 'full').trim() !== '' && (
            <label>
              {nls.t('features.tree.names.displayForm')}
              <input
                value={partOf(name, 'full')}
                onChange={(event) => patch(index, setPartValue(name, 'full', event.target.value))}
              />
            </label>
          )}
          <div className="name-parts-grid">
            {NAME_PART_FIELDS.map((field) => (
              <NamePartField
                key={field}
                field={field}
                value={partOf(name, field)}
                onChange={(value) => patch(index, setPartValue(name, field, value))}
              />
            ))}
          </div>
          <div className="name-variants">
            {name.variants.map((variant, variantIndex) => (
              <div className="variant-block" key={variant.id}>
                <div className="variant-head">
                  <select
                    value={variant.kind}
                    onChange={(event) => patchVariant(index, variantIndex, { kind: event.target.value as NameVariantDraft['kind'] })}
                  >
                    {NAME_VARIANT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {nls.t(`features.tree.names.variant.kind.${kind}`)}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder={nls.t('features.tree.names.language')}
                    value={variant.language}
                    onChange={(event) => patchVariant(index, variantIndex, { language: event.target.value })}
                  />
                  <button
                    className="icon-button"
                    title={nls.t('features.tree.names.variant.remove')}
                    onClick={() => removeVariant(index, variantIndex)}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
                {partOf(variant, 'full').trim() !== '' && (
                  <label>
                    {nls.t('features.tree.names.displayForm')}
                    <input
                      value={partOf(variant, 'full')}
                      onChange={(event) =>
                        patchVariant(index, variantIndex, setPartValue(variant, 'full', event.target.value))
                      }
                    />
                  </label>
                )}
                <div className="name-parts-grid">
                  {NAME_PART_FIELDS.map((field) => (
                    <NamePartField
                      key={field}
                      field={field}
                      value={partOf(variant, field)}
                      onChange={(value) =>
                        patchVariant(index, variantIndex, setPartValue(variant, field, value))
                      }
                    />
                  ))}
                </div>
                <DateEditor
                  label={nls.t('features.tree.names.date')}
                  value={variant.date ?? emptyDate()}
                  onChange={(date) => setVariantDate(index, variantIndex, date)}
                  hidePlace
                />
              </div>
            ))}
            <button className="secondary-button" onClick={() => addVariant(index)}>
              <Plus size={13} aria-hidden="true" />
              {nls.t('features.tree.names.variant.add')}
            </button>
          </div>
        </div>
      ))}
      <button className="secondary-button" onClick={addName}>
        <Plus size={13} aria-hidden="true" />
        {nls.t('features.tree.names.add')}
      </button>
    </div>
  );
}

function NamePartField({
  field,
  value,
  onChange,
}: {
  field: (typeof NAME_PART_FIELDS)[number];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {nls.t(`features.tree.names.part.${field}`)}
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

/** True when the date draft holds nothing the user typed. */
function dateDraftBlank(date: DateDraft): boolean {
  return (
    date.year === '' &&
    date.month === '' &&
    date.day === '' &&
    date.endYear === '' &&
    date.endMonth === '' &&
    date.endDay === '' &&
    date.text.trim() === '' &&
    date.place.trim() === ''
  );
}
