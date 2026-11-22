---
source-hash: 6953c7a55202
---

# Rozwiązywanie problemów

- **Projekt `.doru` ze starszej kompilacji odmawia otwarcia** — przed wersją
  1.0 schemat projektu zmienia się bez migracji, więc pliki zapisane przez inną
  kompilację nie są rozumiane. Otwórz projekt w kompilacji, która go utworzyła,
  wyeksportuj GEDCOM i zaimportuj ten plik do bieżącej kompilacji.
- **„Dostawca AI nie jest skonfigurowany”** — otwórz Ustawienia (ikona koła
  zębatego na lewym pasku), wybierz dostawcę i postępuj zgodnie z kreatorem:
  pobierz listę modeli (lub wybierz model) i zapisz klucz, jeśli jest wymagany.
- **Połączenie z Ollamą nie działa** — wybierz preset Ollama (bazowy URL
  `http://localhost:11434/v1`); klucz API nie jest potrzebny. Kliknij „Pobierz
  modele od dostawcy” — jeśli zgłosi, że dostawca jest nieosiągalny, upewnij
  się, że Ollama działa lokalnie.
