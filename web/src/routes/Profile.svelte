<script lang="ts">
  import { api, ApiError, fieldErrorMap, type Profile } from "../lib/api";
  import { LANGUAGES, LEVELS, findLanguage, findLevel } from "../lib/locale";
  import LocalizedField from "../components/LocalizedField.svelte";
  import PhotoCropper from "../components/PhotoCropper.svelte";
  import FieldError from "../components/FieldError.svelte";

  let profile = $state<Profile | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let fieldErrors = $state<Record<string, string>>({});

  async function load() {
    loading = true;
    try {
      profile = await api.profile.get();
      error = null;
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }
  load();

  async function save() {
    if (!profile) return;
    saving = true;
    error = null;
    fieldErrors = {};
    try {
      profile = await api.profile.put(profile);
    } catch (e) {
      if (e instanceof ApiError && e.issues.length > 0) {
        fieldErrors = fieldErrorMap(e);
        error = "Some fields need fixing.";
      } else {
        error = String(e);
      }
    } finally {
      saving = false;
    }
  }

  function setLanguageName(i: number, value: string) {
    if (!profile) return;
    const match = LANGUAGES.find(
      (l) =>
        l.de.toLowerCase() === value.toLowerCase() ||
        l.en.toLowerCase() === value.toLowerCase(),
    );
    profile.languages = profile.languages.map((row, idx) =>
      idx === i
        ? match
          ? { ...row, name_de: match.de, name_en: match.en }
          : { ...row, name_de: value, name_en: value }
        : row,
    );
  }

  function setLanguageLevel(i: number, key: string) {
    if (!profile) return;
    const m = LEVELS.find((l) => l.key === key);
    if (!m) return;
    profile.languages = profile.languages.map((row, idx) =>
      idx === i ? { ...row, level_de: m.de, level_en: m.en } : row,
    );
  }

  function removeLanguage(i: number) {
    if (!profile) return;
    profile.languages = profile.languages.filter((_, idx) => idx !== i);
  }

  function addLanguage() {
    if (!profile) return;
    profile.languages = [
      ...profile.languages,
      { name_de: "", name_en: "", level_de: "", level_en: "" },
    ];
  }

  let allSkills = $state<{ skill: string; count: number; max_level: number }[]>(
    [],
  );
  api.skills().then((s) => (allSkills = s));
  const availableFeatured = $derived(
    profile
      ? allSkills.filter((s) => !profile!.featured_skills.includes(s.skill))
      : [],
  );

  function addFeatured(name: string) {
    if (!profile) return;
    const v = name.trim();
    if (!v) return;
    if (profile.featured_skills.includes(v)) return;
    profile.featured_skills = [...profile.featured_skills, v];
  }
  function removeFeatured(i: number) {
    if (!profile) return;
    profile.featured_skills = profile.featured_skills.filter(
      (_, idx) => idx !== i,
    );
  }
  function moveFeatured(i: number, dir: -1 | 1) {
    if (!profile) return;
    const j = i + dir;
    if (j < 0 || j >= profile.featured_skills.length) return;
    const next = profile.featured_skills.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    profile.featured_skills = next;
  }

  let photoBuster = $state(0);
  let uploading = $state(false);
  let pendingCrop = $state<File | null>(null);

  function onPhotoPicked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    // Hand off to the cropper; upload happens after crop is applied.
    pendingCrop = file;
  }

  async function uploadCropped(blob: Blob) {
    pendingCrop = null;
    uploading = true;
    error = null;
    try {
      const f = new File([blob], "profile.jpg", { type: "image/jpeg" });
      profile = await api.profile.uploadPhoto(f);
      photoBuster++;
    } catch (e) {
      error = String(e);
    } finally {
      uploading = false;
    }
  }
</script>

<div class="row" style="margin-bottom: 12px; justify-content: space-between;">
  <h2 style="margin:0;">Profile</h2>
  <button class="primary" onclick={save} disabled={saving}>
    {saving ? "Saving…" : "Save"}
  </button>
</div>

{#if error}
  <div class="error">{error}</div>
{/if}

{#if loading || !profile}
  <p class="muted">Loading…</p>
{:else}
  <div class="card">
    <div class="grid-2">
      <div>
        <label>
          <span class="label-text">Name</span>
          <input bind:value={profile.name} />
        </label>
        <FieldError path="name" errors={fieldErrors} />
      </div>
      <div>
        <span class="field-label">Profile photo</span>
        <div class="photo-row">
          <img
            src={`/${profile.photo_path}?v=${photoBuster}`}
            alt={profile.name || "Profile"}
            class="photo-preview"
          />
          <div style="flex: 1;">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onchange={onPhotoPicked}
              disabled={uploading || pendingCrop !== null}
              aria-label="Upload profile photo"
            />
            <p class="muted" style="margin: 4px 0 0;">
              {uploading ? "Uploading…" : profile.photo_path}
            </p>
          </div>
        </div>
        {#if pendingCrop}
          <PhotoCropper
            file={pendingCrop}
            onCancel={() => (pendingCrop = null)}
            onCrop={uploadCropped}
          />
        {/if}
      </div>
      <div>
        <label>
          <span class="label-text">Email</span>
          <input bind:value={profile.email} />
        </label>
        <FieldError path="email" errors={fieldErrors} />
      </div>
      <div>
        <label>
          <span class="label-text">Phone</span>
          <input bind:value={profile.phone} />
        </label>
        <FieldError path="phone" errors={fieldErrors} />
      </div>
      <div>
        <label>
          <span class="label-text">LinkedIn</span>
          <input bind:value={profile.linkedin} />
        </label>
        <FieldError path="linkedin" errors={fieldErrors} />
      </div>
      <div>
        <label>
          <span class="label-text">GitHub</span>
          <input bind:value={profile.github} />
        </label>
        <FieldError path="github" errors={fieldErrors} />
      </div>
    </div>

    <div style="margin-top: 12px;">
      <LocalizedField
        label="Title"
        bind:de={profile.title_de}
        bind:en={profile.title_en}
        onDeChange={(v) => (profile!.title_de = v)}
        onEnChange={(v) => (profile!.title_en = v)}
        deErrorPath="title_de"
        enErrorPath="title_en"
        errors={fieldErrors}
      />
      <LocalizedField
        label="Location"
        bind:de={profile.location_de}
        bind:en={profile.location_en}
        onDeChange={(v) => (profile!.location_de = v)}
        onEnChange={(v) => (profile!.location_en = v)}
        deErrorPath="location_de"
        enErrorPath="location_en"
        errors={fieldErrors}
      />
    </div>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Languages</h3>
    <div class="lang-rows">
      {#each profile.languages as row, i (i)}
        {@const matched = findLanguage(row.name_de, row.name_en)}
        {@const matchedLevel = findLevel(row.level_de, row.level_en)}
        <div class="lang-row">
          <div>
            <label for="lang-name-{i}">Language</label>
            <input
              id="lang-name-{i}"
              list="lang-suggestions"
              value={matched ? matched.de : row.name_de || row.name_en}
              oninput={(e) =>
                setLanguageName(i, (e.currentTarget as HTMLInputElement).value)}
              placeholder="Deutsch / German …"
            />
          </div>
          <div>
            <label for="lang-level-{i}">Proficiency</label>
            <select
              id="lang-level-{i}"
              value={matchedLevel?.key ?? ""}
              onchange={(e) =>
                setLanguageLevel(
                  i,
                  (e.currentTarget as HTMLSelectElement).value,
                )}
            >
              {#if !matchedLevel}
                <option value="" disabled>— pick level —</option>
              {/if}
              {#each LEVELS as l}
                <option value={l.key}>{l.de} · {l.en}</option>
              {/each}
            </select>
          </div>
          <button
            class="danger"
            onclick={() => removeLanguage(i)}
            aria-label="Remove language"
            title="Remove"
          >
            ×
          </button>
        </div>
      {/each}
    </div>
    <datalist id="lang-suggestions">
      {#each LANGUAGES as l}
        <option value={l.de}>{l.en}</option>
      {/each}
    </datalist>
    <button onclick={addLanguage} style="margin-top: 8px;"
      >+ Add language</button
    >
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Education</h3>
    {#each profile.education as _, i (i)}
      <div class="edu-row">
        <div>
          <label for="edu-degree-de-{i}">Degree (DE)</label>
          <input
            id="edu-degree-de-{i}"
            bind:value={profile.education[i]!.degree_de}
            placeholder="B.Sc. Informatik"
          />
        </div>
        <div>
          <label for="edu-degree-en-{i}">Degree (EN)</label>
          <input
            id="edu-degree-en-{i}"
            bind:value={profile.education[i]!.degree_en}
            placeholder="B.Sc. Computer Science"
          />
        </div>
        <div>
          <label for="edu-school-{i}">School</label>
          <input
            id="edu-school-{i}"
            bind:value={profile.education[i]!.school}
            placeholder="TU Berlin"
          />
        </div>
        <div>
          <label for="edu-year-{i}">Year</label>
          <input
            id="edu-year-{i}"
            type="number"
            bind:value={profile.education[i]!.year}
            placeholder="2017"
          />
        </div>
      </div>
    {/each}
    <button
      onclick={() =>
        profile &&
        (profile.education = [
          ...profile.education,
          {
            degree_de: "",
            degree_en: "",
            school: "",
            year: new Date().getFullYear(),
          },
        ])}
      style="margin-top: 8px;">+ Add education</button
    >
  </div>

  <div class="card">
    <h3 style="margin:0;">Default summary</h3>
    <p class="muted" style="margin: 4px 0 12px;">
      Used when generating a non-tailored CV (no JD pasted). 1–3 sentences.
    </p>
    <LocalizedField
      label="Summary"
      multiline
      rows={5}
      bind:de={profile.summary_default_de}
      bind:en={profile.summary_default_en}
      onDeChange={(v) => (profile!.summary_default_de = v)}
      onEnChange={(v) => (profile!.summary_default_en = v)}
      deErrorPath="summary_default_de"
      enErrorPath="summary_default_en"
      errors={fieldErrors}
    />
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Featured skills</h3>
    <p class="muted" style="margin: -4px 0 12px;">
      The skills you want surfaced on the default CV's skill table. Order
      matters — top items show first. Level + project mapping are looked up
      automatically from your projects.
    </p>
    {#each profile.featured_skills as s, i (s + i)}
      <div class="row" style="margin-bottom: 4px;">
        <span style="flex: 1;">{s}</span>
        <button onclick={() => moveFeatured(i, -1)} disabled={i === 0}>↑</button
        >
        <button
          onclick={() => moveFeatured(i, 1)}
          disabled={i === profile.featured_skills.length - 1}>↓</button
        >
        <button class="danger" onclick={() => removeFeatured(i)}>×</button>
      </div>
    {/each}
    <div class="row" style="margin-top: 8px;">
      <select
        aria-label="Add featured skill"
        value=""
        onchange={(e) => {
          const sel = e.currentTarget as HTMLSelectElement;
          if (sel.value) {
            addFeatured(sel.value);
            sel.value = "";
          }
        }}
      >
        <option value="" disabled>
          {availableFeatured.length === 0
            ? "— all canonical skills already featured —"
            : "— add featured skill —"}
        </option>
        {#each availableFeatured as s (s.skill)}
          <option value={s.skill}>
            {s.skill} (L{s.max_level}, in {s.count} project{s.count === 1
              ? ""
              : "s"})
          </option>
        {/each}
      </select>
    </div>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Personal touch</h3>
    <p class="muted" style="margin: -4px 0 12px;">
      A short, memorable line for recruiters at the very end of the CV.
    </p>
    <div class="grid-2">
      <div>
        <label for="hob-intro-de">Lead-in (DE)</label>
        <input
          id="hob-intro-de"
          bind:value={profile.hobbies_intro_de}
          placeholder="Worüber ich nicht aufhören kann zu reden"
        />
      </div>
      <div>
        <label for="hob-intro-en">Lead-in (EN)</label>
        <input
          id="hob-intro-en"
          bind:value={profile.hobbies_intro_en}
          placeholder="Things I can't shut up about"
        />
      </div>
      <div>
        <label for="hob-list-de">Hobbies (DE)</label>
        <input
          id="hob-list-de"
          value={profile.hobbies_de.join(", ")}
          oninput={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            if (profile)
              profile.hobbies_de = v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
          }}
          placeholder="Laufschuhe, ultra-hell geröstete Bohnen"
        />
      </div>
      <div>
        <label for="hob-list-en">Hobbies (EN)</label>
        <input
          id="hob-list-en"
          value={profile.hobbies_en.join(", ")}
          oninput={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            if (profile)
              profile.hobbies_en = v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
          }}
          placeholder="Running shoes, ultra-light roast coffee"
        />
      </div>
    </div>
    <p class="muted" style="margin-top: 8px;">
      Separate items with commas. Renders as
      <em
        >"{(profile.hobbies_intro_de || profile.hobbies_intro_en) +
          ": "}{(profile.hobbies_de.length
          ? profile.hobbies_de
          : profile.hobbies_en
        ).join(" · ")}"</em
      >
    </p>
  </div>
{/if}

<style>
  .photo-row {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .photo-preview {
    width: 100px;
    height: 100px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: #f3f4f6;
    flex-shrink: 0;
  }
  .lang-rows {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .lang-row {
    display: grid;
    grid-template-columns: 1fr 1.4fr auto;
    gap: 8px;
    align-items: end;
  }
  .lang-row > button.danger {
    padding: 6px 10px;
    line-height: 1;
  }
  .edu-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 80px;
    gap: 8px;
    margin-bottom: 12px;
    align-items: end;
  }
</style>
