import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AddressRecord,
  AssociationRecord,
  CitationRecord,
  FactRecord,
  FamilyRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RecordSubmitterLink,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
  TitleRecord,
  TodoRecord,
} from '@doru/core';
import type { MediaWithPath } from '@doru/ui/domain';

export function useTreeSnapshot(projectPath: string | null | undefined) {
  const [persons, setPersons] = useState<PersonRecord[]>([]);
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [facts, setFacts] = useState<FactRecord[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [media, setMedia] = useState<MediaWithPath[]>([]);
  const [citations, setCitations] = useState<CitationRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [places, setPlaces] = useState<PlaceRecord[]>([]);
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [submitters, setSubmitters] = useState<SubmitterRecord[]>([]);
  const [recordSubmitters, setRecordSubmitters] = useState<RecordSubmitterLink[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [tagLinks, setTagLinks] = useState<TagLinkRecord[]>([]);
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [todos, setTodos] = useState<TodoRecord[]>([]);
  const [titles, setTitles] = useState<TitleRecord[]>([]);
  const [associations, setAssociations] = useState<AssociationRecord[]>([]);
  const requestRef = useRef(0);
  const publishedRef = useRef(0);
  const activeProjectPathRef = useRef(projectPath);
  useEffect(() => {
    activeProjectPathRef.current = projectPath;
  }, [projectPath]);

  const reloadTree = useCallback(async (path: string) => {
    const request = ++requestRef.current;
    const [
      data,
      allFacts,
      allSources,
      allMedia,
      allCitations,
      allNotes,
      allPlaces,
      allRepositories,
      allSubmitters,
      allRecordSubmitters,
      allTags,
      allTagLinks,
      allAddresses,
      allTodos,
      allTitles,
      allAssociations,
    ] = await Promise.all([
      window.doru.all(path),
      window.doru.getAllFacts(path),
      window.doru.getSources(path),
      window.doru.getAllMedia(path),
      window.doru.getAllCitations(path),
      window.doru.listNotes(path),
      window.doru.getPlaces(path),
      window.doru.getRepositories(path),
      window.doru.getSubmitters(path),
      window.doru.getAllRecordSubmitters(path),
      window.doru.getTags(path),
      window.doru.getAllTagLinks(path),
      window.doru.listAddresses(path),
      window.doru.getTodos(path),
      window.doru.getTitles(path),
      window.doru.getAllAssociations(path),
    ]);
    if (path !== activeProjectPathRef.current || request < publishedRef.current) {
      return;
    }
    publishedRef.current = request;
    setPersons(data.persons);
    setFamilies(data.families);
    setFacts(allFacts);
    setSources(allSources);
    setMedia(allMedia);
    setCitations(allCitations);
    setNotes(allNotes);
    setPlaces(allPlaces);
    setRepositories(allRepositories);
    setSubmitters(allSubmitters);
    setRecordSubmitters(allRecordSubmitters);
    setTags(allTags);
    setTagLinks(allTagLinks);
    setAddresses(allAddresses);
    setTodos(allTodos);
    setTitles(allTitles);
    setAssociations(allAssociations);
  }, []);

  useEffect(() => {
    if (!projectPath) {
      requestRef.current += 1;
      publishedRef.current = requestRef.current;
      setPersons([]);
      setFamilies([]);
      setFacts([]);
      setSources([]);
      setMedia([]);
      setCitations([]);
      setNotes([]);
      setPlaces([]);
      setRepositories([]);
      setSubmitters([]);
      setRecordSubmitters([]);
      setTags([]);
      setTagLinks([]);
      setAddresses([]);
      setTodos([]);
      setTitles([]);
      setAssociations([]);
      return;
    }
    void reloadTree(projectPath);
  }, [projectPath, reloadTree]);

  // External writers (the in-app agent, ACP agents, MCP clients) mutate the
  // project file through their own connections; reload when the main process
  // reports a change so the tree stays in sync without manual reopening.
  useEffect(() => {
    if (!projectPath) {
      return;
    }
    return window.doru.onTreeExternalChange(() => {
      void reloadTree(projectPath);
    });
  }, [projectPath, reloadTree]);

  const refreshTree = useCallback(async () => {
    const activePath = activeProjectPathRef.current;
    if (activePath) {
      await reloadTree(activePath);
    }
  }, [reloadTree]);
  return {
    persons,
    families,
    facts,
    sources,
    media,
    citations,
    notes,
    places,
    repositories,
    submitters,
    recordSubmitters,
    tags,
    tagLinks,
    addresses,
    todos,
    titles,
    associations,
    refreshTree,
  };
}
