import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'Ελληνικά',
  lang: 'el',
  description:
    'Μια desktop εφαρμογή για γενεαλογικά δέντρα. Το δέντρο σας ζει σε έναν συνηθισμένο φάκελο στον δίσκο σας, λειτουργεί πλήρως εκτός σύνδεσης και καθοδηγείται από πράκτορες ΤΝ — μέσω της ενσωματωμένης συνομιλίας ή οποιουδήποτε πελάτη MCP/ACP.',
  footer: 'Το όνομα προέρχεται από το πρωτοϊνδοευρωπαϊκό <em>*dóru</em> — «δέντρο».',
  nav: {
    docs: 'Τεκμηρίωση',
    releases: 'Σημειώσεις έκδοσης',
  },
  sidebar: {
    intro: 'Εισαγωγή',
    getStarted: 'Ξεκινώντας',
    installation: 'Εγκατάσταση και ενημερώσεις',
    quickStart: 'Γρήγορη εκκίνηση',
    guide: 'Οδηγός',
    tree: 'Εργασία με το δέντρο',
    shortcuts: 'Συντομεύσεις πληκτρολογίου',
    settings: 'Ρυθμίσεις',
    agents: 'ΤΝ και πράκτορες',
    themes: 'Θέματα',
    reference: 'Αναφορά',
    dataBackups: 'Δεδομένα και αντίγραφα ασφαλείας',
    troubleshooting: 'Αντιμετώπιση προβλημάτων',
  },
  ui: {
    outline: 'Σε αυτή τη σελίδα',
    prev: 'Προηγούμενη σελίδα',
    next: 'Επόμενη σελίδα',
    returnToTop: 'Επιστροφή στην κορυφή',
    skipToContent: 'Μετάβαση στο περιεχόμενο',
    menu: 'Μενού',
    appearance: 'Εμφάνιση',
    lightTheme: 'Εναλλαγή σε φωτεινό θέμα',
    darkTheme: 'Εναλλαγή σε σκοτεινό θέμα',
    langMenu: 'Αλλαγή γλώσσας',
    mainNavigation: 'Κύρια πλοήγηση',
    mobileMenu: 'Μενού',
    moreOptions: 'Περισσότερες επιλογές',
  },
  notFound: {
    title: 'Η ΣΕΛΙΔΑ ΔΕΝ ΒΡΕΘΗΚΕ',
    quote: 'Αν όμως δεν αλλάξετε κατεύθυνση και συνεχίσετε να ψάχνετε, μπορεί να καταλήξετε εκεί όπου πηγαίνετε.',
    linkLabel: 'μετάβαση στην αρχική',
    linkText: 'Επιστροφή στην αρχική',
  },
  search: SEARCH_TEXT['el'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'Αντιγραφή κώδικα',
      copiedText: 'Αντιγράφηκε',
    },
  },
};

export default locale;
