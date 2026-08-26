export function tap() {
  try {
    navigator.vibrate?.(8)
  } catch {
    /* unsupported */
  }
}

export function error() {
  try {
    navigator.vibrate?.([30, 40, 30])
  } catch {
    /* unsupported */
  }
}

export function success() {
  try {
    navigator.vibrate?.([12, 30, 12])
  } catch {
    /* unsupported */
  }
}
