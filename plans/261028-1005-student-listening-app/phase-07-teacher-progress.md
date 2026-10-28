# Phase 7: Home listening in the Teacher app

## Requirements

- Class page section "Home listening": per child, green leaves this week and the last 8 weeks (★ when 4+), and the
  share of the class reaching 4 this week vs the 80% goal. Data from `ListeningLog` (mode HOME) of children with an
  active enrollment in the class.
- Children with 0–1 days this week highlighted (the guide asks teachers to message those families).
- A "Listening Time link" card: the student app URL and a QR code to share with parents.

## Steps

1. API `GET /api/teach/classes/:id/listening` (teacher of the class or school admin).
2. Teacher app section + QR (generated client side, no external service).
3. e2e for access; unit test for the week bucketing (Monday-start weeks in Asia/Ho_Chi_Minh).
