/* Observer's cyber-context addendum. The frozen Kempsey glossary is not changed.
 * Return escaped HTML text only; do not use this function in an attribute, URL,
 * identifier or code block. Unknown and differently cased terms remain intact.
 */
(function (root) {
  'use strict';

  // These expansions apply to Observer's cyber-advisory text, not every possible
  // use of the same abbreviation in a council record or another discipline.
  const glossary = Object.freeze({
    ACSC: 'Australian Cyber Security Centre',
    ASD: 'Australian Signals Directorate',
    CVE: 'Common Vulnerabilities and Exposures',
    GHSA: 'GitHub Security Advisory',
    CVSS: 'Common Vulnerability Scoring System',
    KEV: 'Known Exploited Vulnerabilities',
    NVD: 'National Vulnerability Database',
    API: 'application programming interface',
    DNS: 'Domain Name System',
    HTTPS: 'Hypertext Transfer Protocol Secure',
    HTTP: 'Hypertext Transfer Protocol',
    TLS: 'Transport Layer Security',
    URL: 'uniform resource locator',
    RSS: 'Really Simple Syndication',
    'SHA-256': 'Secure Hash Algorithm 256',
    RCE: 'remote code execution',
    XSS: 'cross-site scripting',
    SQL: 'Structured Query Language',
    DDoS: 'distributed denial of service',
    DoS: 'denial of service',
    MFA: 'multi-factor authentication',
    VPN: 'virtual private network',
    IoT: 'Internet of Things'
  });

  // Source references identify authorities for cyber-context terminology.
  // They are an Observer addendum, not definitions attributed to the KSC
  // glossary. Do not use this list to resolve abbreviations in other fields.
  const authorities = Object.freeze({
    ACSC: 'https://www.cyber.gov.au/who-we-are',
    ASD: 'https://www.cyber.gov.au/who-we-are',
    CISA: 'https://www.cisa.gov/about',
    CVE: 'https://csrc.nist.gov/glossary/term/common_vulnerabilities_and_exposures',
    KEV: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    NVD: 'https://nvd.nist.gov/',
    CVSS: 'https://www.first.org/cvss/',
    GHSA: 'https://docs.github.com/en/rest/security-advisories/repository-advisories',
    API: 'https://csrc.nist.gov/glossary/term/application_programming_interface',
    DNS: 'https://csrc.nist.gov/glossary/term/dns',
    DDoS: 'https://csrc.nist.gov/glossary/term/active_attack',
    DoS: 'https://csrc.nist.gov/glossary/term/active_attack',
    IoT: 'https://csrc.nist.gov/files/pubs/other/2018/05/30/enhancing-resilience-against-botnetsreport-to-the-/final/docs/eo_13800_botnet_report_-_finalv2.pdf',
    XSS: 'https://csrc.nist.gov/glossary/term/cross_site_scripting',
    TLS: 'https://csrc.nist.gov/glossary/term/transport_layer_security',
    HTTPS: 'https://csrc.nist.gov/glossary/term/hypertext_transfer_protocol_secure',
    AI: 'https://csrc.nist.gov/glossary/term/artificial_intelligence',
    'SHA-256': 'https://csrc.nist.gov/glossary/term/sha_256',
    VPN: 'https://www.cisa.gov/sites/default/files/2024-06/joint-guide-modern-approaches-to-secure-network-access-security-508c.pdf'
  });

  const contextOnly = [
    {term: 'ATO', expansion: 'Australian Taxation Office in Australian tax-service records; can also mean account takeover in cyber reports. Check context.', source: 'https://www.ato.gov.au/'},
    {term: 'OSFA', expansion: 'Online services for agents, the ATO service. Check context before applying this meaning elsewhere.', source: 'https://www.ato.gov.au/tax-and-super-professionals/digital-services/online-services-for-agents'},
    {term: 'IP', expansion: 'Internet Protocol in network addressing; can also mean intellectual property or other terms. Check context.', source: 'https://csrc.nist.gov/glossary/term/IP'},
    {term: 'CISA', expansion: 'Cybersecurity and Infrastructure Security Agency in US agency references; can also mean the Cybersecurity Information Sharing Act. Check context.', source: 'https://www.cisa.gov/about'},
    {term: 'AI', expansion: 'Artificial intelligence in this cyber-observatory context. Check context before applying elsewhere.', source: 'https://csrc.nist.gov/glossary/term/artificial_intelligence'},
    {term: 'MAYHEM', expansion: 'Modular Audit and Yield for Humans Enforcement Mechanism, according to the local MAYHEM core specification.', source: null},
    {term: 'DFAPTI', expansion: 'The MAYHEM evidence-gathering stage; full acronym expansion is not established by this addendum.', source: null},
    {term: 'DFAPTA', expansion: 'The MAYHEM analysis stage; full acronym expansion is not established by this addendum.', source: null}
  ];

  function getGlossaryTerms() {
    return Object.entries(glossary)
      .map(([term, expansion]) => ({term, expansion, source: authorities[term] || null}))
      .concat(contextOnly.map(item => ({...item})))
      .sort((a, b) => a.term.localeCompare(b.term));
  }

  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  // Longest first ensures HTTPS and numbered CVE identifiers remain intact.
  const alternatives = Object.keys(glossary).sort((a, b) => b.length - a.length);
  const matcher = new RegExp('\\b(?:CVE-\\d{4}-\\d{4,}|GHSA(?:-[23456789cfghjmpqrvwxCFGHJMPQRVWX]{4}){3}|' + alternatives.join('|') + ')\\b', 'g');

  function expandAcronyms(value) {
    const text = String(value ?? '');
    let result = '', end = 0;
    const expanded = new Set();
    for (const match of text.matchAll(matcher)) {
      const token = match[0];
      const isCveId = /^CVE-\d{4}-\d{4,}$/.test(token);
      const isGhsaId = /^GHSA(?:-[23456789cfghjmpqrvwxCFGHJMPQRVWX]{4}){3}$/.test(token);
      const key = isCveId ? 'CVE' : isGhsaId ? 'GHSA' : token;
      const full = glossary[key];
      const preceding = text.slice(0, match.index).toLowerCase();
      // If the source already supplies its expansion immediately before the
      // abbreviation, leave its wording as encountered instead of doubling it.
      const alreadyWritten = preceding.endsWith(full.toLowerCase() + ' (');
      result += escapeText(text.slice(end, match.index));
      if (expanded.has(key) || alreadyWritten) {
        result += escapeText(token);
      } else if (isCveId || isGhsaId) {
        result += escapeText(token) + ' (' + escapeText(full) + ' identifier)';
      } else {
        result += escapeText(full) + ' (' + escapeText(token) + ')';
      }
      expanded.add(key);
      end = match.index + token.length;
    }
    return result + escapeText(text.slice(end));
  }

  root.expandAcronyms = expandAcronyms;
  root.getGlossaryTerms = getGlossaryTerms;
  if (typeof module === 'object' && module.exports) module.exports = {expandAcronyms, getGlossaryTerms, glossary};
})(typeof globalThis === 'object' ? globalThis : this);
