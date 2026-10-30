@extends('emails._layout')

@section('body')
  <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;">
    Magandang araw, {{ $appointment->full_name }}!
  </p>

  <p style="margin:0 0 16px;">
    Ito ay magiliw na paalala (reminder) na ang inyong appointment sa <strong>Barangay Natumolan</strong> ay 
    <span style="display:inline-block;padding:2px 10px;background:#EDE9FE;color:#5B21B6;font-weight:700;border-radius:12px;font-size:12px;">NGAYONG ARAW (TODAY)</span>.
  </p>

  <table style="width:100%;margin:20px 0;border-collapse:collapse;background:#F9FAFB;border-radius:12px;border:1px solid #E5E7EB;font-size:13px;">
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;width:35%;">Reference No.:</td>
      <td style="padding:10px 16px;font-weight:700;color:#111827;border-bottom:1px solid #E5E7EB;">{{ $appointment->appointment_number }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;">Nakatakdang Oras:</td>
      <td style="padding:10px 16px;font-weight:700;color:#723EC3;border-bottom:1px solid #E5E7EB;font-size:15px;">{{ $appointment->appointment_time }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;">Pakay:</td>
      <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #E5E7EB;">{{ $appointment->purpose }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;">Lugar:</td>
      <td style="padding:10px 16px;color:#111827;">Barangay Hall, Barangay Natumolan, Tagoloan</td>
    </tr>
  </table>

  <p style="margin:16px 0;font-size:13px;color:#4B5563;">
    Mangyaring maghanda at magtungo sa Barangay Hall sa takdang oras. Dalhin ang inyong valid ID o Barangay Resident Card.
  </p>

  <p style="margin:20px 0 0;font-size:12px;color:#6B7280;">
    Inaasahan namin ang inyong pagdating.<br>
    <strong>Office of the Barangay Secretary & Punong Barangay</strong>
  </p>
@endsection
