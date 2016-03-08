
// Translateable string file
// Could be json, but js object notation is easier to edit by hand:
// Comments, line-breaks in long strings, trailing commas

module.exports = {

  resetPasswordEmailSubject: {
    cParams: 1,
    text: "Reset your %s password",
  },

  resetPasswordEmail: {
    cParams: 4,
    text: "Hi %s,\n\n" +
      "We got a request to reset your %s password.\n\n" +
      "Please click this link from your phone to reset it:\n\n" +
      "%s\n\n" +
      "If you ignore this message, your password won't be changed.\n\n" +
      "Thanks!\n\n" +
      "-The %s team",
    html: "<p>Hi %s,</p>" +
      "<p>We got a request to reset your %s password.</p>" +
      "<p>Please click this link from your phone to reset it:</p>" +
      "<p>%s</p>" +
      "<p>If you ignore this message, your password won't be changed.</p>" +
      "<p>Thanks!</p>" +
      "<p>-The %s team</p>",
  },

  resetPasswordConfirmEmailSubject: {
    cParams: 1,
    text: "Your %s password has been reset"
  },

  resetPasswordConfirmEmail: {
    cParams: 5,
    text: "Hi %s,\n\n" +
      "This is a confirmation that the password for your %s account %s has just been changed.\n\n" +
      "If you didn't request a password change please contact us at immediately at %s.\n\n" +
      "-The %s Team",
    html: "<p>Hi %s,</p>" +
      "<p>This is a confirmation that the password for your %s account %s has just been changed.</p>" +
      "<p>If you didn't request a password change please contact us at immediately at %s.</p>" +
      "<p>-The %s Team</p>",
  },

}
