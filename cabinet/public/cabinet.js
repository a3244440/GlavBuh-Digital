// Небольшие удобства; без JavaScript кабинет работает полностью.
document.querySelectorAll('input[name="bin"]').forEach(input => input.addEventListener('input', () => {
  const digits = input.value.replace(/\D/g, '').slice(0, 12);
  if (digits !== input.value) input.value = digits;
}));
// Повторное нажатие на кнопку, пока форма отправляется, не создаёт дубль.
document.querySelectorAll('form').forEach(form => form.addEventListener('submit', () => {
  setTimeout(() => form.querySelectorAll('button[type="submit"]').forEach(button => { button.disabled = true; }), 0);
}));
