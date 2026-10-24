import { useEffect, useState, type FormEvent } from "react";
import { errorMessage, request } from "../api";
import type { OwnFreelancerProfile, PortfolioItem } from "../types";

export function FreelancerProfileEditor() {
  const [profile, setProfile] = useState<OwnFreelancerProfile | null>(null);
  const [bio, setBio] = useState("");
  const [rate, setRate] = useState("");
  const [availability, setAvailability] = useState("AVAILABLE");
  const [skills, setSkills] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function load() {
    try {
      const data = await request<OwnFreelancerProfile>("/profile/freelancer");
      setProfile(data);
      setBio(data.bio);
      setRate(data.hourlyRate?.toString() || "");
      setAvailability(data.availability);
      setSkills(data.skills.map((item) => item.name).join(", "));
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
      setMessage("Профіль збережено.");
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function addPortfolio(event: FormEvent) {
    event.preventDefault();
    try {
      await request<PortfolioItem>("/profile/portfolio", {
        method: "POST",
        body: { title, url },
      });
      setTitle("");
      setUrl("");
      await load();
    } catch (e) {
      setError(errorMessage(e));
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
  if (!profile && !error)
    return <div className="page-loading">Завантажуємо профіль…</div>;
  return (
    <section className="account-panel">
      <div className="section-heading">
        <div>
          <h2>Профіль фрилансера</h2>
          <p>Ці дані бачить клієнт під час вибору виконавця.</p>
        </div>
      </div>
      {message && <p className="notice success">{message}</p>}
      {error && <p className="form-error">{error}</p>}
      <form className="form-grid" onSubmit={(e) => void save(e)}>
        <label className="full-width">
          Про себе
          <textarea
            maxLength={3000}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <label>
          Ставка за годину, грн
          <input
            type="number"
            min="0"
            max="10000000"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
        <label>
          Доступність
          <select
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="AVAILABLE">Доступний</option>
            <option value="BUSY">Зайнятий</option>
            <option value="UNAVAILABLE">Недоступний</option>
          </select>
        </label>
        <label className="full-width">
          Навички через кому
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="TypeScript, React, NestJS"
          />
        </label>
        <button className="button primary">Зберегти профіль</button>
      </form>
      <h3>Портфоліо</h3>
      <form className="inline-form" onSubmit={(e) => void addPortfolio(e)}>
        <label>
          Назва
          <input
            required
            minLength={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          HTTPS-посилання
          <input
            required
            type="url"
            pattern="https://.*"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <button className="button secondary">
          <i className="bi bi-plus-lg" aria-hidden="true"></i>
          Додати роботу
        </button>
      </form>
      <div className="simple-list">
        {profile?.portfolio.map((item) => (
          <article className="list-card" key={item.id}>
            <div>
              <a href={item.url} target="_blank" rel="noreferrer">
                <strong>{item.title}</strong>
              </a>
              <small>{item.description}</small>
            </div>
            <button
              className="button secondary"
              onClick={() => void remove(item.id)}
            >
              <i className="bi bi-trash" aria-hidden="true"></i>
              Видалити
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
