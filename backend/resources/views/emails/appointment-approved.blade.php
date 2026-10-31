@extends('emails._layout')

@section('body')
  <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;">
    Greetings, {{ $appointment->full_name }}!
  </p>

  <p style="margin:0 0 16px;">
    Your appointment request with <strong>Barangay Natumolan</strong> has been 
    <span style="display:inline-block;padding:2px 10px;background:#DEF7EC;color:#03543F;font-weight:700;border-radius:12px;font-size:12px;">CONFIRMED & APPROVED</span>.
  </p>

  <table style="width:100%;margin:20px 0;border-collapse:collapse;background:#F9FAFB;border-radius:12px;border:1px solid #E5E7EB;font-size:13px;">
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;width:35%;">Reference No.:</td>
      <td style="padding:10px 16px;font-weight:700;color:#111827;border-bottom:1px solid #E5E7EB;">{{ $appointment->appointment_number }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;">Confirmed Date:</td>
      <td style="padding:10px 16px;font-weight:700;color:#723EC3;border-bottom:1px solid #E5E7EB;">{{ \Carbon\Carbon::parse($appointment->appointment_date)->format('F d, Y (l)') }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;">Confirmed Time:</td>
      <td style="padding:10px 16px;font-weight:700;color:#723EC3;border-bottom:1px solid #E5E7EB;">{{ $appointment->appointment_time }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;">Purpose:</td>
      <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #E5E7EB;">{{ $appointment->purpose }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;">Venue:</td>
      <td style="padding:10px 16px;color:#111827;">Barangay Hall, Barangay Natumolan, Tagoloan</td>
    </tr>
  </table>

  <p style="margin:16px 0;font-size:13px;color:#4B5563;">
    <strong>Important Notice:</strong> Please bring a valid government ID (or Barangay Resident ID) and any supporting documents relevant to your visit. Please arrive at the Barangay Hall 10-15 minutes prior to your scheduled time.
  </p>

  <p style="margin:20px 0 0;font-size:12px;color:#6B7280;">
    Thank you for your cooperation.<br>
    <strong>Office of the Barangay Secretary & Punong Barangay</strong>
  </p>
@endsection

