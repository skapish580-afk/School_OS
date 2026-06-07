from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
import csv
from io import StringIO

class ExportMixin:
    """
    Mixin to add export functionality to ViewSets
    Add to any ViewSet to enable CSV/JSON export
    """
    
    @action(detail=False, methods=['get'], url_path='export')
    def export_data(self, request):
        """
        Export data as CSV or JSON
        Usage: GET /api/endpoint/export/?format=csv
        """
        export_format = request.query_params.get('format', 'csv').lower()
        queryset = self.filter_queryset(self.get_queryset())
        
        if export_format == 'csv':
            return self._export_csv(queryset)
        elif export_format == 'json':
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        else:
            return Response(
                {'error': 'Invalid format. Use csv or json'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def _export_csv(self, queryset):
        """Generate CSV export"""
        # Get first object to determine fields
        if not queryset.exists():
            return HttpResponse('No data to export', content_type='text/csv')
        
        # Serialize data
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data
        
        # Create CSV
        output = StringIO()
        if data:
            writer = csv.DictWriter(output, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
        
        # Prepare response
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{self.basename}_export.csv"'
        return response
