import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { apiUrl, errorMessage, request } from "../api";
import type { OwnFreelancerProfile, PortfolioItem } from "../types";

import { useLanguage } from "../i18n";
export function FreelancerProfileEditor() {
  const { tr } = useLanguage();
  const [profile, setProfile] = useState<OwnFreelancerProfile | null>(null);
  const [bio, setBio] = useState("");
  const [rate, setRate] = useState("");
  const [availability, setAvailability] = useState("AVAILABLE");
  const [skills, setSkills] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [tags, setTags] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  function pickCover(file: File | null) {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCover(file);
    setCoverPreview(file ? URL.createObjectURL(file) : "");
  }
  const [adding, setAdding] = useState(false);
  const [savingWork, setSavingWork] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Заповнений профіль показуємо лише для читання; олівець вмикає редагування
  const [editing, setEditing] = useState(false);
  function fill(data: OwnFreelancerProfile) {
    setBio(data.bio);
    setRate(data.hourlyRate?.toString() || "");
    setAvailability(data.availability);
    setSkills(data.skills.map((item) => item.name).join(", "));
  }
  async function load() {
    try {
      const data = await request<OwnFreelancerProfile>("/profile/freelancer");
      setProfile(data);
      fill(data);
      if (!data.bio && !data.skills.length && data.hourlyRate === null)
        setEditing(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await request("/profile/freelancer", {
        method: "PATCH",
        body: {
          bio,
          hourlyRate: rate ? Number(rate) : undefined,
          availability,
          skills: skills
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
      });
      setMessage(tr("Профіль збережено."));
      setEditing(false);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  // Робота створюється, потім (за бажанням) завантажується обкладинка
  async function addPortfolio(event: FormEvent) {
    event.preventDefault();
    setSavingWork(true);
    setError("");
    try {
      const item = await request<PortfolioItem>("/profile/portfolio", {
        method: "POST",
        body: {
          title,
          description: workDescription || undefined,
          tags: tags || undefined,
          url: url || undefined,
        },
      });
      if (cover) {
        const body = new FormData();
        body.append("file", cover);
        await request(`/profile/portfolio/${item.id}/image`, {
          method: "POST",
          body,
        });
      }
      setTitle("");
      setUrl("");
      setWorkDescription("");
      setTags("");
      pickCover(null);
      setAdding(false);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSavingWork(false);
    }
  }
  async function remove(id: string) {
    try {
      await request(`/profile/portfolio/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const skillList = [
    ...new Set(
      skills
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (!profile && !error)
    return <div className="page-loading">{tr("Завантажуємо профіль…")}</div>;
  return (
    <section className="account-panel">
      <div className="section-heading">
        <div>
          <h2>{tr("Профіль фрілансера")}</h2>
          <p>{tr("Ці дані бачить клієнт під час вибору виконавця.")}</p>
        </div>
        {!editing && (
          <button
            type="button"
            className="icon-action"
            aria-label={tr("Редагувати профіль фрілансера")}
            title={tr("Редагувати профіль фрілансера")}
            onClick={() => {
              setMessage("");
              setEditing(true);
            }}
          >
            <i className="bi bi-pencil" aria-hidden="true"></i>
          </button>
        )}
      </div>
      {message && <p className="notice success">{message}</p>}
      {error && <p className="form-error">{error}</p>}
      <form className="form-grid" onSubmit={(e) => void save(e)}>
        <fieldset
          className="form-grid full-width plain-fieldset"
          disabled={!editing}
        >
          <label className="full-width">
            {tr("Про себе")}
            <textarea
              maxLength={3000}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
          <label>
            {tr("Ставка за годину, грн")}
            <input
              type="number"
              min="0"
              max="10000000"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <label>
            {tr("Доступність")}
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            >
              <option value="AVAILABLE">{tr("Доступний")}</option>
              <option value="BUSY">{tr("Зайнятий")}</option>
              <option value="UNAVAILABLE">{tr("Недоступний")}</option>
            </select>
          </label>
          <label className="full-width">
            {tr("Навички через кому")}
            <input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="TypeScript, React, NestJS"
            />
          </label>
          {/* Чипи — як клієнт побачить навички (оновлюються під час введення) */}
          {skillList.length > 0 && (
            <ul className="skill-chips full-width" aria-label={tr("Навички")}>
              {skillList.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          )}
        </fieldset>
        {editing && (
          <div className="page-actions full-width">
            <button className="button primary">{tr("Зберегти профіль")}</button>
            {profile && (profile.bio || profile.skills.length > 0) && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  fill(profile);
                  setEditing(false);
                }}
              >
                {tr("Скасувати")}
              </button>
            )}
          </div>
        )}
      </form>
      <div className="portfolio-heading">
        <h3>{tr("Портфоліо")}</h3>
        {!adding && (
          <button
            type="button"
            className="button secondary"
            onClick={() => setAdding(true)}
          >
            <i className="bi bi-plus-lg" aria-hidden="true"></i>
            {tr("Додати роботу")}
          </button>
        )}
      </div>
      {adding && (
        <form
          className="form-grid portfolio-form"
          onSubmit={(e) => void addPortfolio(e)}
        >
          <label>
            {tr("Назва роботи")}
            <input
              required
              minLength={2}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr("Напр. Інтернет-магазин кераміки")}
            />
          </label>
          <label>
            {tr("Технології через кому")}
            <input
              maxLength={300}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="React, NestJS, PostgreSQL"
            />
          </label>
          <label className="full-width">
            {tr("Що зроблено")}
            <textarea
              maxLength={2000}
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              placeholder={tr(
                "Задача клієнта, ваша роль і результат: що працює, які цифри",
              )}
            />
          </label>
          <label>
            {tr("Посилання (необов'язково)")}
            <input
              type="url"
              pattern="https://.*"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
            />
          </label>
          <label>
            {tr("Обкладинка: PNG, JPG або WEBP, до 2 МБ")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
            />
          </label>
          {cover && (
            <img
              className="portfolio-preview full-width"
              src={coverPreview}
              alt={tr("Попередній перегляд обкладинки")}
            />
          )}
          <div className="page-actions full-width">
            <button className="button primary" disabled={savingWork}>
              {savingWork ? tr("Зберігаємо…") : tr("Додати роботу")}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setAdding(false)}
            >
              {tr("Скасувати")}
            </button>
          </div>
        </form>
      )}
      {profile?.portfolio.length ? (
        <div className="portfolio-grid editor">
          {profile.portfolio.map((item) => (
            <PortfolioCard key={item.id} item={item}>
              <button
                type="button"
                className="icon-action danger"
                aria-label={tr("Видалити роботу {0}", item.title)}
                title={tr("Видалити")}
                onClick={() => void remove(item.id)}
              >
                <i className="bi bi-trash" aria-hidden="true"></i>
              </button>
            </PortfolioCard>
          ))}
        </div>
      ) : (
        !adding && (
          <p className="form-note">
            {tr(
              "Додайте 2–3 роботи з обкладинкою й описом — клієнти частіше обирають виконавців із портфоліо.",
            )}
          </p>
        )
      )}
    </section>
  );
}

// Картка роботи: обкладинка, опис, технології й посилання (спільна для редактора й профілю)
export function PortfolioCard({
  item,
  children,
}: {
  item: PortfolioItem;
  children?: ReactNode;
}) {
  const { tr } = useLanguage();
  const tags = (item.tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return (
    <article className="portfolio-card">
      <div className="portfolio-cover">
        {item.imageUrl ? (
          <img src={apiUrl(item.imageUrl)} alt="" loading="lazy" />
        ) : (
          <i className="bi bi-image" aria-hidden="true"></i>
        )}
        {children}
      </div>
      <div className="portfolio-body">
        <strong>{item.title}</strong>
        {item.description && <p>{item.description}</p>}
        {tags.length > 0 && (
          <ul className="skill-chips">
            {tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer">
            {tr("Відкрити роботу")}
            <i
              className="bi bi-box-arrow-up-right"
              aria-label={tr("відкриється в новій вкладці")}
            ></i>
          </a>
        )}
      </div>
    </article>
  );
}
