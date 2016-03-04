
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
    text: "Hello %s,\n\n" +
      "Please click the link below to reset your %s password:\n\n" +
      "%s\n\n" +
      "If you did not request the password reset, you can ignore this email.\n\n" +
      "Thanks!\n\n" +
      "-The %s team",
    html: "<p>Hello %s</p>" +
      "<p>Please click the link below to reset your %s password:</p>" +
      "<p>%s</p>" +
      "<p>If you did not request the password reset, you can ignore this email.</p>" +
      "<p>Thanks!</p>" +
      "<p>-The %s team</p>",
  },
}
