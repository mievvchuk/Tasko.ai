import { Link } from "react-router";
import { formatDate } from "../format";
import { ratingStars } from "../types";
import { UserAvatar } from "./UserAvatar";

// Відгук у профілі: фото й ім'я автора ведуть на його профіль
export function ReviewItem({
  author,
  profilePath,
  fallbackName,
  rating,
  comment,
  emptyComment,
  projectTitle,
  createdAt,
}: {
  author: { id: string; name: string; avatarUrl?: string | null } | null;
  profilePath: string;
  fallbackName: string;
  rating: number;
  comment: string | null;
  emptyComment: string;
  projectTitle: string;
  createdAt: string;
}) {
  const name = author?.name || fallbackName;
  const avatar = <UserAvatar name={name} avatarUrl={author?.avatarUrl} />;
  return (
    <li className="review-item">
      {author ? (
        <Link to={`${profilePath}/${author.id}`} tabIndex={-1}>
          {avatar}
        </Link>
      ) : (
        avatar
      )}
      <div>
        <div className="review-item-head">
          {author ? <Link to={`${profilePath}/${author.id}`}>{name}</Link> : <span>{name}</span>}
          <strong className="stars" aria-label={`${rating} / 5`}>
            {ratingStars(rating)}
          </strong>
        </div>
        <p>{comment || emptyComment}</p>
        <small>
          {projectTitle} · {formatDate(createdAt)}
        </small>
      </div>
    </li>
  );
}
