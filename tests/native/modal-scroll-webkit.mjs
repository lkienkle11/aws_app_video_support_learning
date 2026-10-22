const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
try {
  document.body.style.minHeight = '3000px';
  window.scrollTo(0, 200);
  const results = [];
  for (const id of ['caption-settings-dialog', 'zoom-settings-dialog']) {
    const dialog = document.getElementById(id);
    dialog.style.maxHeight = '180px';
    const before = document.scrollingElement.scrollTop;
    dialog.showModal();
    check(
      getComputedStyle(document.documentElement).overflowY === 'hidden',
      `${id}: root scroll not locked`,
    );
    check(getComputedStyle(document.body).overflowY === 'hidden', `${id}: body scroll not locked`);
    check(
      getComputedStyle(dialog).overscrollBehaviorY === 'contain',
      `${id}: scroll can chain at edges`,
    );
    check(dialog.scrollHeight > dialog.clientHeight, `${id}: modal cannot scroll`);
    dialog.scrollTop = 70;
    check(dialog.scrollTop > 0, `${id}: inner scroll blocked`);
    dialog.scrollTop = dialog.scrollHeight;
    check(document.scrollingElement.scrollTop === before, `${id}: background position changed`);
    results.push({ id, innerScroll: dialog.scrollTop, backgroundScroll: before });
    dialog.close();
    check(
      getComputedStyle(document.documentElement).overflowY !== 'hidden',
      'root did not unlock after close',
    );
  }
  window.webkit.messageHandlers.result.postMessage(JSON.stringify({ passed: true, results }));
} catch (error) {
  window.webkit.messageHandlers.result.postMessage(
    JSON.stringify({ passed: false, error: `${error.message}\n${error.stack}` }),
  );
}
