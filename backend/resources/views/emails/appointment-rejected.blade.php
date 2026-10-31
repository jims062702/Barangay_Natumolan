@extends('emails._layout')

@section('body')
  <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;">
    Greetings, {{ $appointment->full_name }}!
  </p>

  <p style="margin:0 0 16px;">
    We regret to inform you that your appointment request with <strong>Barangay Natumolan</strong> could not be accommodated at this time.
  </p>

  <table style="width:100%;margin:20px 0;border-collapse:collapse;background:#F9FAFB;border-radius:12px;border:1px solid #E5E7EB;font-size:13px;">
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;width:35%;">Reference No.:</td>
      <td style="padding:10px 16px;font-weight:700;color:#111827;border-bottom:1px solid #E5E7EB;">{{ $appointment->appointment_number }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;">Requested Date:</td>
      <td style="padding:10px 16px;font-weight:700;color:#111827;border-bottom:1px solid #E5E7EB;">{{ \Carbon\Carbon::parse($appointment->appointment_date)->format('F d, Y (l)') }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;">Requested Time:</td>
      <td style="padding:10px 16px;font-weight:700;color:#111827;border-bottom:1px solid #E5E7EB;">{{ $appointment->appointment_time }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;">Purpose:</td>
      <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #E5E7EB;">{{ $appointment->purpose }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#DC2626;border-bottom:1px solid #E5E7EB;">Reason for Rejection:</td>
      <td style="padding:10px 16px;color:#DC2626;font-weight:600;border-bottom:1px solid #E5E7EB;">{{ $appointment->rejection_reason }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;">Status:</td>
      <td style="padding:10px 16px;font-weight:700;color:#DC2626;">Declined / Rejected</td>
    </tr>
  </table>

  <p style="margin:16px 0;font-size:13px;color:#4B5563;">
    If you have any questions or wish to reschedule for another date, please visit the Barangay Hall during office hours (Mon–Fri, 8:00 AM – 5:00 PM) or submit a new appointment request through your portal account.
  </p>

  <p style="margin:20px 0 0;font-size:12px;color:#6B7280;">
    Thank you for your understanding.<br>
    <strong>Office of the Barangay Secretary & Punong Barangay</strong>
  </p>
@endsection

