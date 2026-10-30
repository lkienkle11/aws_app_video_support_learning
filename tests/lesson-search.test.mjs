import test from 'node:test';
import assert from 'node:assert/strict';
import { searchLessonTitles } from '../ui/features/library/lesson-search.js';

test('lesson search matches multilingual titles without accents and excludes descriptions', () => {
  const lessons = [
    {
      id: 'ec2',
      texts: {
        en: { title: 'EC2 Basics', description: 'IAM' },
        vi: { title: 'Cơ bản máy chủ đám mây' },
      },
    },
    { id: 'iam', texts: { en: { title: 'IAM', description: 'EC2 Basics' } } },
  ];
  assert.deepEqual(
    searchLessonTitles(lessons, ' EC2 basics ').map((l) => l.id),
    ['ec2'],
  );
  assert.deepEqual(
    searchLessonTitles(lessons, 'DAM MAY').map((l) => l.id),
    ['ec2'],
  );
  assert.deepEqual(searchLessonTitles(lessons, 'missing'), []);
  assert.equal(searchLessonTitles(lessons, '').length, 2);
});
