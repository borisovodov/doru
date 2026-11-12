import { Plus, Star, X } from 'lucide-react';
import { nls } from '../../nls';
import { Button } from '../../atoms/button/Button';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Field } from '../../atoms/field/Field';
import { FieldGrid } from '../../atoms/field-grid/FieldGrid';
import { Input } from '../../atoms/form/Input';
import { Select } from '../../atoms/form/Select';
import { Subcard } from '../../patterns/subcard/Subcard';
import { DateEditor } from '../date/DateEditor';
import {
  NAME_PART_FIELDS,
  NAME_TYPES,
  NAME_VARIANT_KINDS,
  dateDraftBlank,
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
import styles from './NamesSection.module.css';

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
    <div className={styles['namesSection']}>
      {names.map((name, index) => (
        <Subcard key={name.id}>
          <div className={styles['head']}>
            <span className={styles['label']}>{nameDraftDisplay(name) || '—'}</span>
            <IconButton
              size="sm"
              label={nls.t('features.tree.names.primary')}
              icon={<Star size={14} fill={name.primary ? 'currentColor' : 'none'} aria-hidden="true" />}
              onClick={() => markPrimary(index)}
            />
            <IconButton
              size="sm"
              label={nls.t('features.tree.names.remove')}
              icon={<X size={14} aria-hidden="true" />}
              onClick={() => removeName(index)}
            />
          </div>
          <FieldGrid columns={2}>
            <Field label={nls.t('features.tree.names.type')}>
              <Select value={name.type} onChange={(event) => patch(index, { type: event.target.value })}>
                <option value="">{nls.t('features.tree.names.type.none')}</option>
                {NAME_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {nls.t(`features.tree.names.type.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={nls.t('features.tree.names.language')}>
              <Input
                value={name.language}
                onChange={(event) => patch(index, { language: event.target.value })}
              />
            </Field>
          </FieldGrid>
          <DateEditor
            label={nls.t('features.tree.names.date')}
            value={name.date ?? emptyDate()}
            onChange={(date) => setDate(index, date)}
            hidePlace
          />
          {partOf(name, 'full').trim() !== '' && (
            <Field label={nls.t('features.tree.names.displayForm')}>
              <Input
                value={partOf(name, 'full')}
                onChange={(event) => patch(index, setPartValue(name, 'full', event.target.value))}
              />
            </Field>
          )}
          <FieldGrid columns={3}>
            {NAME_PART_FIELDS.map((field) => (
              <NamePartField
                key={field}
                field={field}
                value={partOf(name, field)}
                onChange={(value) => patch(index, setPartValue(name, field, value))}
              />
            ))}
          </FieldGrid>
          <div className={styles['variants']}>
            {name.variants.map((variant, variantIndex) => (
              <div className={styles['variant']} key={variant.id}>
                <div className={styles['variantHead']}>
                  <Select
                    aria-label={nls.t('features.tree.names.variant.kind.translation')}
                    value={variant.kind}
                    onChange={(event) =>
                      patchVariant(index, variantIndex, { kind: event.target.value as NameVariantDraft['kind'] })
                    }
                  >
                    {NAME_VARIANT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {nls.t(`features.tree.names.variant.kind.${kind}`)}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label={nls.t('features.tree.names.language')}
                    placeholder={nls.t('features.tree.names.language')}
                    value={variant.language}
                    onChange={(event) => patchVariant(index, variantIndex, { language: event.target.value })}
                  />
                  <IconButton
                    size="sm"
                    label={nls.t('features.tree.names.variant.remove')}
                    icon={<X size={14} aria-hidden="true" />}
                    onClick={() => removeVariant(index, variantIndex)}
                  />
                </div>
                {partOf(variant, 'full').trim() !== '' && (
                  <Field label={nls.t('features.tree.names.displayForm')}>
                    <Input
                      value={partOf(variant, 'full')}
                      onChange={(event) =>
                        patchVariant(index, variantIndex, setPartValue(variant, 'full', event.target.value))
                      }
                    />
                  </Field>
                )}
                <FieldGrid columns={3}>
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
                </FieldGrid>
                <DateEditor
                  label={nls.t('features.tree.names.date')}
                  value={variant.date ?? emptyDate()}
                  onChange={(date) => setVariantDate(index, variantIndex, date)}
                  hidePlace
                />
              </div>
            ))}
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus size={13} aria-hidden="true" />}
              onClick={() => addVariant(index)}
            >
              {nls.t('features.tree.names.variant.add')}
            </Button>
          </div>
        </Subcard>
      ))}
      <Button
        size="sm"
        variant="secondary"
        icon={<Plus size={13} aria-hidden="true" />}
        onClick={addName}
      >
        {nls.t('features.tree.names.add')}
      </Button>
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
    <Field label={nls.t(`features.tree.names.part.${field}`)}>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
