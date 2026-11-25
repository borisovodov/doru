import { useState, type ComponentProps } from 'react';
import type { Demo, DemoMeta } from '../../../gallery/types';
import type { TargetRef } from '@doru/core';
import { TARGET_TYPES } from '@doru/core/model';
import { TASK_TARGET_TYPES, type TargetData } from '../task/taskTargets';
import { TargetPicker } from './TargetPicker';

const data: TargetData = {
  persons: [
    {
      id: 'P1',
      sex: 'F',
      names: [{ id: 'N1', given: 'Anna', surname: 'Ivanova', parts: [], primary: true }],
      facts: [],
    },
    {
      id: 'P2',
      sex: 'M',
      names: [{ id: 'N2', given: 'Mikhail', surname: 'Petrov', parts: [] }],
      facts: [],
    },
  ],
  families: [
    {
      id: 'F1',
      partners: ['P1', 'P2'],
      children: [],
      partnerLinks: [
        { id: 'FP1', personId: 'P1' },
        { id: 'FP2', personId: 'P2' },
      ],
      childLinks: [],
      marriageStatuses: [{ id: 'FMS1', status: 'married' }],
    },
  ],
  sources: [{ id: 'S1', title: 'Ivanovka parish register, 1890–1910' }],
  places: [
    {
      id: 'L1',
      names: [
        { id: 'LN1', kind: 'official', position: 0, value: 'Ivanovka' },
        { id: 'LN2', kind: 'official', position: 1, value: 'Tula Oblast' },
      ],
    },
  ],
  repositories: [{ id: 'R1', name: 'State Archive of Tula Oblast' }],
  titles: [{ id: 'TIT1', name: 'Tula province parish registers' }],
  facts: [],
  citations: [],
  media: [
    {
      id: 'M1',
      title: 'Ivanova family photograph',
      files: [{ id: 'MF1', path: 'media/ivanova-1908.jpg', title: 'Front side' }],
    },
  ],
  submitters: [{ id: 'SUB1', name: 'Boris Ovodov' }],
  addresses: [
    {
      id: 'A1',
      lines: [{ id: 'AL1', value: '3 Sadovaya Street' }],
      city: 'Tula',
      country: 'Russia',
    },
  ],
  associations: [],
  tasks: [{ id: 'TASK1', text: 'Find the parish register', targets: [] }],
};

function StatefulTargetPicker(args: ComponentProps<typeof TargetPicker>) {
  const [value, setValue] = useState<TargetRef[]>([...args.value]);
  return (
    <div style={{ width: 380, paddingBottom: 340 }}>
      <TargetPicker {...args} value={value} onChange={setValue} />
    </div>
  );
}

const meta = {
  title: 'Domain/TargetPicker',
  component: TargetPicker,
  args: {
    allowedTypes: TASK_TARGET_TYPES,
    data,
    value: [{ targetType: 'person', targetId: 'P1' }],
    onChange: () => undefined,
  },
  render: (args) => <StatefulTargetPicker {...(args as ComponentProps<typeof TargetPicker>)} />,
} satisfies DemoMeta<typeof TargetPicker>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const AllAttachmentTypes: DemoCase = {
  args: {
    allowedTypes: TARGET_TYPES,
    value: [],
  },
};

export const NoSelection: DemoCase = {
  args: {
    value: [],
  },
};
