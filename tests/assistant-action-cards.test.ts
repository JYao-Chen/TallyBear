import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatActionCards } from '../src/components/ChatActionCards';
import type { LoggedChatAction } from '../src/server/chat-actions';

test('result cards show undo, completed undo, or an irreversible result', () => {
  const card: LoggedChatAction = {
    id: 'entry',
    kind: 'entry',
    bookId: 'book',
    title: '记录账目',
    status: 'confirmed',
    data: { title: '午餐', amount: 1500 },
    missing: [],
    warnings: [],
    summary: [],
    actionLogId: 'log',
    canUndo: true,
  };
  const noop = async () => {};
  const render = (action: LoggedChatAction, undone = new Set<string>()) =>
    renderToStaticMarkup(
      createElement(ChatActionCards, {
        actions: [action],
        disabled: false,
        confirmable: false,
        onUndo: noop,
        undone,
        onConfirm: noop,
        onEdit: noop,
        onCancel: noop,
        onRevise: noop,
      }),
    );
  assert.match(render(card), />撤销<\/button>/);
  assert.match(render(card, new Set(['log'])), />已撤销</);
  assert.match(render({ ...card, canUndo: false }), />不可撤销</);
});
