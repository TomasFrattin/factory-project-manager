export const appSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 42,
    height: 42,
    borderRadius: 12,
    borderColor: state.isFocused ? 'var(--color-primary)' : 'var(--color-border-strong)',
    boxShadow: state.isFocused ? '0 0 0 2px var(--color-primary-soft)' : 'none',
    backgroundColor: 'var(--color-surface)',
    '&:hover': {
      borderColor: 'var(--color-primary)',
    },
  }),
  valueContainer: (base) => ({
    ...base,
    height: 42,
    paddingLeft: 10,
    paddingRight: 6,
    paddingTop: 0,
    paddingBottom: 0,
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: 40,
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: 'var(--color-text-soft)',
    paddingRight: 10,
  }),
  indicatorSeparator: (base) => ({
    ...base,
    backgroundColor: 'var(--color-border)',
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--color-text)',
  }),
  input: (base) => ({
    ...base,
    color: 'var(--color-text)',
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
  }),
  placeholder: (base) => ({
    ...base,
    color: 'var(--color-text-muted)',
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    boxShadow: 'var(--shadow-card)',
    zIndex: 30,
  }),
  menuList: (base) => ({
    ...base,
    padding: 6,
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: 8,
    color: 'var(--color-text)',
    backgroundColor: state.isSelected
      ? 'var(--color-primary-soft)'
      : state.isFocused
        ? 'var(--color-bg-soft)'
        : 'var(--color-surface)',
    cursor: 'pointer',
  }),
}
