import type { Meta, StoryObj } from '@storybook/react-vite';
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
} satisfies Meta<typeof EntityViewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Person: Story = {};

export const Entity: Story = {
  args: {
    media: undefined,
    title: 'Parish register of Ivanovka',
    subtitle: 'Source · 1890',
    badges: undefined,
    actions: undefined,
  },
};
