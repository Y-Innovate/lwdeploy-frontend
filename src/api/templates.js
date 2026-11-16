import { decodeBase64Utf8, encodeBase64Utf8 } from '../lib/base64'
import { apiRequest } from './client'
import { defineList } from './lists'

// O2: the active templates of an application in order; at most 20, never paged
export const templates = defineList({ path: '/templates', listKey: 'templates' })
// O2: the revisions of a template, newest first
export const templateRevisions = defineList({
  path: '/templateRevisions', listKey: 'revisions', since: [['revision_since', 'revision']],
})

const templatePath = (templateID) => `/templates/${encodeURIComponent(templateID)}`

// Also a deleted one (templateStatus D), so frozen JCL can be traced to it
export function getTemplate(templateID) {
  return apiRequest('GET', templatePath(templateID))
}

// Owners only. fields: templateName, maxRC, sortOrder (0: at the end). A new
// template has no JCL (currentRev 0) and blocks deployments until it has.
export function createTemplate(appID, fields) {
  return apiRequest('POST', '/templates', { body: { appID, ...fields } })
}

export function updateTemplate(templateID, fields) {
  return apiRequest('PUT', templatePath(templateID), { body: fields })
}

// Status D; its revisions stay
export function deleteTemplate(templateID) {
  return apiRequest('DELETE', templatePath(templateID))
}

// The JCL of a revision (0: the current one), decoded: { revision,
// lineCount, text }
export async function getTemplateJcl(templateID, revision = 0) {
  const { jcl, ...rest } = await apiRequest('GET', `/templateJcl/${encodeURIComponent(templateID)}`, {
    query: { revision: revision || undefined },
  })
  return { ...rest, text: decodeBase64Utf8(jcl) }
}

// Saves JCL as the next revision, as multipart with the fields jcl (base64
// of UTF-8) and changeNote. Answers { revision, lineCount, warningCount,
// infoMessage }: the first warning. 08 56 refuses it, naming the line.
export function saveTemplateJcl(templateID, text, changeNote) {
  return apiRequest('POST', `/templateJcl/${encodeURIComponent(templateID)}`, {
    form: { jcl: encodeBase64Utf8(text), changeNote },
  })
}
