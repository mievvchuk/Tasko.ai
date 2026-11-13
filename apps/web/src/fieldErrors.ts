// Помилки форм — під самим полем, а не спливаючою підказкою браузера чи повідомленням угорі.
// Один обробник на весь документ: працює в кожній формі, де поля мають required/min/max/minLength тощо.

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

// Коротке пояснення, що не так, мовою інтерфейсу
export function fieldMessage(
  validity: Pick<
    ValidityState,
    | "valueMissing"
    | "tooShort"
    | "tooLong"
    | "rangeOverflow"
    | "rangeUnderflow"
    | "typeMismatch"
    | "badInput"
    | "stepMismatch"
  >,
  field: {
    type: string;
    min: string;
    max: string;
    minLength: number;
    maxLength: number;
    valueLength: number;
    fallback: string;
  },
  language: "uk" | "en",
) {
  const uk = language === "uk";
  if (validity.valueMissing)
    return uk ? "Заповніть це поле." : "Please fill in this field.";
  if (validity.tooShort)
    return uk
      ? `Щонайменше ${field.minLength} символів (зараз ${field.valueLength}).`
      : `At least ${field.minLength} characters (now ${field.valueLength}).`;
  if (validity.tooLong)
    return uk
      ? `Не більше ${field.maxLength} символів.`
      : `At most ${field.maxLength} characters.`;
  if (validity.rangeOverflow)
    return uk ? `Не більше ${field.max}.` : `At most ${field.max}.`;
  if (validity.rangeUnderflow)
    return uk ? `Не менше ${field.min}.` : `At least ${field.min}.`;
  if (validity.typeMismatch && field.type === "email")
    return uk
      ? "Введіть правильну адресу пошти, напр. name@example.com."
      : "Enter a valid email, e.g. name@example.com.";
  if (validity.typeMismatch && field.type === "url")
    return uk
      ? "Введіть посилання, що починається з https://."
      : "Enter a link starting with https://.";
  if (validity.badInput || validity.stepMismatch)
    return uk ? "Введіть ціле число." : "Enter a whole number.";
  return field.fallback;
}

const isField = (target: EventTarget | null): target is Field =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement;

// Підпис ставимо після поля; у поля пароля — після обгортки з кнопкою «око»
function anchor(field: Field) {
  return field.closest(".password-field") ?? field;
}

function show(field: Field, language: "uk" | "en") {
  const message = fieldMessage(
    field.validity,
    {
      type: field.type,
      min: "min" in field ? field.min : "",
      max: "max" in field ? field.max : "",
      minLength: "minLength" in field ? field.minLength : -1,
      maxLength: "maxLength" in field ? field.maxLength : -1,
      valueLength: field.value.length,
      fallback: field.validationMessage,
    },
    language,
  );
  const id = `${field.id || field.name || "field"}-auto-error`;
  let note = anchor(field).nextElementSibling;
  if (!(note instanceof HTMLElement && note.dataset.autoError)) {
    note = document.createElement("small");
    (note as HTMLElement).dataset.autoError = "true";
    note.className = "field-error";
    note.id = id;
    note.setAttribute("role", "alert");
    anchor(field).insertAdjacentElement("afterend", note);
  }
  note.textContent = message;
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", note.id);
}

function clear(field: Field) {
  const note = anchor(field).nextElementSibling;
  if (note instanceof HTMLElement && note.dataset.autoError) note.remove();
  if (field.dataset.autoInvalid) {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
    delete field.dataset.autoInvalid;
  }
}

export function installFieldErrors(language: () => "uk" | "en") {
  let focused = false;
  document.addEventListener(
    "invalid",
    (event) => {
      if (!isField(event.target)) return;
      event.preventDefault(); // без спливаючої підказки браузера
      const field = event.target;
      field.dataset.autoInvalid = "true";
      show(field, language());
      // Курсор — у перше поле з помилкою, щоб людина одразу бачила, що виправити
      if (!focused) {
        focused = true;
        field.focus();
        queueMicrotask(() => (focused = false));
      }
    },
    true,
  );
  const recheck = (event: Event) => {
    if (!isField(event.target) || !event.target.dataset.autoInvalid) return;
    if (event.target.validity.valid) clear(event.target);
    else show(event.target, language());
  };
  document.addEventListener("input", recheck, true);
  document.addEventListener("change", recheck, true);
}
