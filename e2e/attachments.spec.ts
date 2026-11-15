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

      await window.doru.addTodo(project, {
        id: 'AT1',
        text: 'Check the register',
        targetType: 'family',
        targetId: 'F1',
        createdDate: { quality: 'exact', component: { year: 2026 } },
        closedDate: { quality: 'exact', component: { year: 2026, month: 12 } },
      });
      const todos = await window.doru.getTodos(project);
      const todo = todos.find((entry) => entry.id === 'AT1');
      if (
        todo === undefined ||
        todo.targetType !== 'family' ||
        todo.targetId !== 'F1' ||
        todo.createdDate?.component?.year !== 2026 ||
        todo.closedDate?.component?.month !== 12
      ) {
        throw new Error('task fields missing');
      }

      await window.doru.addTodo(project, {
        id: 'AT2',
        text: 'Check the register',
        targetType: 'person',
        targetId: 'I1',
      });
      const personTodos = await window.doru.getTodosFor(project, 'person', 'I1');
      if (personTodos.length !== 1 || personTodos[0]?.id !== 'AT2') {
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
  await expect(page.getByLabel('Related to')).toBeVisible();
  await expect(page.getByLabel('Related to').locator('option')).toHaveCount(24);
  await expect(page.getByLabel('Related to').locator('option', { hasText: 'Event' })).toHaveCount(1);
});
