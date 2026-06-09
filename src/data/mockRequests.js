// ===========================================================================
// mockRequests.js
// ---------------------------------------------------------------------------
// Sample COI request examples for training and for trying the analyzer
// without a live inbox. Loadable from the Request Analyzer page.
// ===========================================================================

export const MOCK_REQUESTS = [
  {
    id: "sample_1",
    label: "Example 1 - GL + Auto, AI & WOS, named project",
    requestFrom: "General Contractor (certificate holder)",
    insuredName: "Summit Drywall & Finishing LLC",
    certHolderName: "Cornerstone Builders Inc",
    certHolderAddress: "742 Industrial Pkwy, Suite 200, Reno, NV 89502",
    projectName: "123 Main Street Renovation",
    requiredCoverage: "General Liability and Auto Liability",
    requiredEndorsements:
      "Additional Insured and Waiver of Subrogation in favor of the certificate holder",
    specialWording: "",
    deliveryInstructions: "Email PDF to coi@cornerstonebuilders.com",
    dueDate: "",
    internalNotes:
      "Standard subcontractor onboarding request. Confirm AI/WOS endorsements are on the policy.",
    rawText:
      "Certificate holder requests proof of General Liability and Auto Liability. They also request Additional Insured and Waiver of Subrogation in favor of the certificate holder. Project: 123 Main Street Renovation.",
  },
  {
    id: "sample_2",
    label: "Example 2 - Tenant vendor, GL + WC, PNC, 30-day notice",
    requestFrom: "Property Manager",
    insuredName: "BrightClean Janitorial Services Inc",
    certHolderName: "Maple Grove Property Management",
    certHolderAddress: "1500 Commerce Dr, Las Vegas, NV 89101",
    projectName: "Tenant vendor work - Maple Grove Plaza",
    requiredCoverage: "General Liability and Workers Compensation",
    requiredEndorsements: "Primary and Non-Contributory wording",
    specialWording: "30-day cancellation notice if available",
    deliveryInstructions: "Upload to vendor portal",
    dueDate: "",
    internalNotes:
      "Confirm PNC endorsement before adding wording. Do not promise cancellation notice the policy does not provide.",
    rawText:
      "Property manager requests COI for tenant vendor work. Requires General Liability, Workers Compensation, Primary and Non-Contributory wording, and 30-day cancellation notice if available.",
  },
  {
    id: "sample_3",
    label: "Example 3 - Lender requests mortgagee / loss payee (escalate)",
    requestFrom: "Lender",
    insuredName: "Harbor Point Holdings LLC",
    certHolderName: "First Republic Lending Group",
    certHolderAddress: "88 Financial Plaza, Phoenix, AZ 85004",
    projectName: "Harbor Point commercial property loan",
    requiredCoverage: "Property / evidence of insurance",
    requiredEndorsements: "Mortgagee / Loss Payee wording",
    specialWording: "Lender's loss payable in favor of First Republic Lending Group",
    deliveryInstructions: "Email to loandocs@frlg.com",
    dueDate: "",
    internalNotes:
      "Lender wants mortgagee/loss payee — likely an ACORD 27/28 evidence form, not an ACORD 25 alone. Escalate.",
    rawText:
      "Lender requests evidence showing mortgagee/loss payee wording. App should flag this as possibly not an ACORD 25-only request and suggest escalation.",
  },
];
