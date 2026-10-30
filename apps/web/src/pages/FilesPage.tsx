import { Link, useParams, useSearchParams } from "react-router";
import { useApi } from "../useApi";
import { parsePage, formatDate } from "../format";
import { FileDownload, FileUpload } from "../components/FileActions";
import { Pagination, ResourceState } from "../components/ResourceState";
import type { FileAttachment, Project } from "../types";

import { useLanguage } from "../i18n";
export function FilesPage() {
  const { tr } = useLanguage();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const project = useApi<Project>(`/projects/${id}`);
  const files = useApi<FileAttachment[]>(
    project.data ? `/projects/${id}/files?page=${page}&limit=20` : null,
  );
  if (!project.data)
    return (
      <ResourceState
        loading={project.loading}
        error={project.error}
        onRetry={project.refresh}
      />
    );
  const closed = ["COMPLETED", "CANCELLED"].includes(project.data.status);
  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        {tr("← До проєкту")}
      </Link>
      <div className="page-heading">
        <h1>{tr("Файли проєкту")}</h1>
        <p>{project.data.title}</p>
      </div>
      <section className="data-panel padded">
        {!closed && (
          <FileUpload
            projectId={project.data.id}
            onUploaded={() => {
              setParams({});
              files.refresh();
            }}
          />
        )}
        {closed && (
          <p className="form-note">
            {tr("Проєкт закрито. Файли доступні для завантаження.")}
          </p>
        )}
        <div className="panel-heading">
          <h2>{tr("Прикріплені файли")}</h2>
          <button className="button secondary" onClick={files.refresh}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>

            {tr("Оновити")}
          </button>
        </div>
        <ResourceState
          loading={files.loading}
          error={files.error}
          onRetry={files.refresh}
        />
        {files.data && (
          <>
            {!files.data.length && (
              <p className="empty-state">
                {tr("На цій сторінці файлів немає.")}
              </p>
            )}
            <ul className="record-list">
              {files.data.map((file) => (
                <li key={file.id}>
                  <FileDownload file={file} />
                  <p className="form-note">
                    {formatDate(file.uploadedAt || null, true)}
                    {file.submissionId &&
                      tr(" · Прикріплено до результату роботи")}
                  </p>
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              count={files.data.length}
              onChange={(value) => setParams({ page: String(value) })}
            />
          </>
        )}
      </section>
    </>
  );
}
