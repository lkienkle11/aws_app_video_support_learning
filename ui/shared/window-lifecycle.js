/** Prevent closing synchronously; destroy only after every database write succeeds. */
export async function installCloseGuard(appWindow, flush, onError) {
  let closing = false;
  const close = async (event) => {
    event?.preventDefault();
    if (closing) return;
    closing = true;
    try {
      await flush();
      await appWindow.destroy();
    } catch (error) {
      closing = false;
      onError(error);
    }
  };
  await appWindow.onCloseRequested(close);
  await appWindow.listen('cloud-study:quit', () => close());
  return close;
}
