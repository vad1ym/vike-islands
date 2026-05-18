export { onCreateApp }
 
function onCreateApp(pageContext: any) {
  if (pageContext.isRenderingHead) {
    // Don't add plugins when rendering <head> (see Lifecycle)
    return
  }
  const app = pageContext.app
}