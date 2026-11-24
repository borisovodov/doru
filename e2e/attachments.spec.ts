import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, openProject } from './launch';
import { seedFamilyTree } from './seed';

test('attachments, addresses and task fields round-trip through the desktop IPC', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-e2e-')), 'attachments.doru');
  const { page } = await launchApp();
  await expect(page.getByRole('region', { name: 'Welcome' })).toBeVisible();

  await openProject(page, project);
  await seedFamilyTree(page, project);

  await page.evaluate(
    async ({ project }) => {
      await window.doru.addNote(project, {
        id: 'AN1',
        text: 'fact note',
        targetType: 'fact',
        targetId: 'B1',
      });
      if ((await window.doru.listNotes(project, 'fact', 'B1')).length !== 1) {
        throw new Error('fact note missing');
      }

      await window.doru.addNote(project, {
        id: 'AN2',
        text: 'name note',
        targetType: 'name',
        targetId: 'N1',
      });
      if ((await window.doru.listNotes(project, 'name', 'N1')).length !== 1) {
        throw new Error('name note missing');
      }

      await window.doru.addNote(project, {
        id: 'AN3',
        text: 'shared note',
        targetType: 'person',
        targetId: 'I1',
      });
      const link = { id: 'AL1', targetType: 'family', targetId: 'F1' };
      await window.doru.attachNote(project, 'AN3', link);
      if ((await window.doru.listNotes(project, 'family', 'F1')).length !== 1) {
        throw new Error('shared note missing');
      }
      const shared = (await window.doru.listNotes(project, 'person', 'I1')).find((note) => note.id === 'AN3');
      if (shared === undefined) {
        throw new Error('shared note projection missing');
      }
      await window.doru.detachNote(project, shared, link);
      if ((await window.doru.listNotes(project, 'family', 'F1')).length !== 0) {
        throw new Error('shared note detached');
      }

      await window.doru.addAddress(project, {
        id: 'A1',
        lines: [{ id: 'AL1', value: '1 Main Street' }],
        city: 'Testville',
      });
      await window.doru.updateAddress(
        project,
        { id: 'A1', lines: [{ id: 'AL1', value: '1 Main Street' }], city: 'Testville' },
        { id: 'A1', lines: [{ id: 'AL1', value: '2 Main Street' }], city: 'Testville' },
      );
      await window.doru.addFact(project, {
        id: 'AF1',
        personId: 'I1',
        tag: 'RESI',
        addressId: 'A1',
      });
      await window.doru.deleteAddress(project, {
        id: 'A1',
        lines: [{ id: 'AL1', value: '2 Main Street' }],
        city: 'Testville',
      });
      const facts = await window.doru.getFacts(project, 'I1');
      const residence = facts.find((fact) => fact.id === 'AF1');
      if (residence === undefined || residence.addressId !== undefined) {
        throw new Error('address was not detached from the fact');
      }

      const createdStamp = new Date(2026, 0, 1).getTime();
      const closedStamp = new Date(2026, 11, 1).getTime();
      await window.doru.addTask(project, {
        id: 'AT1',
        text: 'Check the register',
        targets: [{ id: 'ATL1', taskId: 'AT1', targetType: 'family', targetId: 'F1' }],
        status: 'closed',
        createdAt: createdStamp,
        closedAt: closedStamp,
      });
      const tasks = await window.doru.getTasks(project);
      const task = tasks.find((entry) => entry.id === 'AT1');
      if (
        task === undefined ||
        !task.targets.some((link) => link.targetType === 'family' && link.targetId === 'F1') ||
        task.createdAt !== createdStamp ||
        task.closedAt !== closedStamp
      ) {
        throw new Error('task fields missing');
      }

      await window.doru.addTask(project, {
        id: 'AT2',
        text: 'Check the register',
        targets: [{ id: 'ATL2', taskId: 'AT2', targetType: 'person', targetId: 'I1' }],
      });
      const personTasks = await window.doru.getTasksFor(project, 'person', 'I1');
      if (personTasks.length !== 1 || personTasks[0]?.id !== 'AT2') {
        throw new Error('per-target task query missing');
      }
      const associations = await window.doru.getAllAssociations(project);
      if (!Array.isArray(associations)) {
        throw new Error('association query missing');
      }
    },
    { project },
  );

  await page.reload();
  await expect(page.getByRole('region', { name: 'Family Tree' })).toBeVisible();
  await page.getByRole('button', { name: 'People' }).click();
  const peopleList = page.getByRole('complementary', { name: 'People' }).getByRole('list');
  await peopleList.getByRole('button').first().click();
  await expect(page.getByRole('region', { name: 'Person editor' })).toBeVisible();

  const tasks = page.getByRole('region', { name: 'Tasks' }).filter({ hasText: 'Check the register' });
  await expect(tasks).toBeVisible();
  await tasks.getByRole('button', { name: 'Open task' }).click();
  const taskRelated = page.getByRole('region', { name: 'Related to' });
  const targetOptions = taskRelated.getByRole('listbox');
  await taskRelated.getByLabel('Related to').click();
  await expect(targetOptions.getByRole('group', { name: 'Person' })).toBeVisible();
  await expect(targetOptions.getByRole('group', { name: 'Family' })).toBeVisible();
  await expect(targetOptions.getByRole('group', { name: 'Event' })).toBeVisible();
  await expect(targetOptions.getByRole('group', { name: 'Media link' })).toHaveCount(0);
  await expect(targetOptions.getByRole('group', { name: 'Source' })).toHaveCount(0);
  await expect(targetOptions.getByRole('group', { name: 'Task' })).toHaveCount(0);
  await expect(targetOptions.getByRole('group', { name: 'Submitter' })).toHaveCount(0);
  await expect(targetOptions.getByRole('group', { name: 'Sex sources' })).toHaveCount(0);
});
