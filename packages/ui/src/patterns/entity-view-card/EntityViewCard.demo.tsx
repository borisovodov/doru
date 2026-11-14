import type { Demo, DemoMeta } from '../../../gallery/types';
import { Avatar } from '../../atoms/display/Avatar';
import { Badge } from '../../atoms/display/Badge';
import { Button } from '../../atoms/button/Button';
import { EntityViewCard } from './EntityViewCard';

const meta = {
  title: 'Patterns/EntityViewCard',
  component: EntityViewCard,
  args: {
    media: <Avatar initials="II" tone="male" size="lg" />,
    title: 'Ivan Ivanov',
    subtitle: '1923 – 1990 (67)',
    badges: <Badge>3</Badge>,
    actions: (
      <>
        <Button size="sm" variant="primary">
          Save
        </Button>
        <Button size="sm" variant="secondary">
          Back
        </Button>
      </>
    ),
  },
} satisfies DemoMeta<typeof EntityViewCard>;

export default meta;
type DemoCase = Demo;

export const Person: DemoCase = {};

export const Entity: DemoCase = {
  args: {
    media: undefined,
    title: 'Parish register of Ivanovka',
    subtitle: 'Source · 1890',
    badges: undefined,
    actions: undefined,
  },
};
